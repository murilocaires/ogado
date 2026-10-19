# Deploy da API no Railway (E3)

A API (`apps/api`) roda no Railway com o Postgres do mesmo projeto (`ogado`, ambiente `production`). O site (Next.js) continua na Vercel e fala com a API pelo rewrite `/api/*` (ADR-0010 a.5): para o navegador, API e site são a mesma origem (`https://ogado.vercel.app`), então o cookie `__Host-ogado_session` (Secure, HttpOnly, SameSite=Lax) é de primeira parte.

## Arquivos

- `apps/api/Dockerfile`: node 22, pnpm 11.13.1 via corepack, `pnpm install --frozen-lockfile --filter "@ogado/api..."`, `prisma generate`, build com tsup. O `CMD` roda `prisma migrate deploy` e depois `node apps/api/dist/server.js`.
- `railway.json` (raiz): usa o Dockerfile acima e o healthcheck `GET /health`. O Railway marcou o formato como legado (vale até 2026-12-01); migrar depois com `railway config migrate`.
- `.dockerignore`: mantém o contexto pequeno (sem `references`, `docs`, `node_modules`, `.env*`).

## Variáveis do serviço `api` (sem segredos no repositório)

| Variável | Valor | Observação |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | referência ao serviço chamado exatamente `Postgres` (URL privada) |
| `NODE_ENV` | `production` | liga cookie Secure/`__Host-` e HSTS (falha fechado) |
| `WEB_ORIGIN` | `https://ogado.vercel.app` | lista de origens separadas por vírgula; vale para CORS e para a barreira de CSRF (`Origin`). Acrescente a URL de preview da Vercel só se for usar a API a partir dela |
| `PROXY_SECRET` | segredo de 32+ caracteres | o mesmo valor na Vercel; ver "Limites de taxa" |
| `TRUST_PROXY` | `100.64.0.0/10` | obrigatório em produção; faixa interna do proxy do Railway |

`PORT` é injetada pelo Railway (o servidor usa `PORT` quando `API_PORT` não existe). A API não tem segredo próprio: a sessão é um token aleatório cujo hash fica no banco.

### Limites de taxa atrás de dois proxies

O tráfego chega pela Vercel (rewrite) e depois pelo proxy do Railway, então `request.ip` na API é o egress da Vercel (igual para todos). O site (`apps/web/proxy.ts`) repassa o IP real em `x-ogado-client-ip` com o segredo compartilhado `PROXY_SECRET` em `x-ogado-proxy-secret`; a API (`plugins/client-ip.ts`) só confia no IP repassado quando o segredo confere (comparação em tempo constante) e o IP é válido. Cabeçalhos `x-ogado-*` vindos de fora são descartados pelo proxy do site. Os limites voltaram aos padrões (cadastro 5/h, login 20/min por IP, 5/min por IP+e-mail).

`PROXY_SECRET` (mínimo 32 caracteres, igual nos dois lados): Railway (serviço `api`) e Vercel (Production e Preview). Para girar: gere outro, atualize os dois e faça novo deploy; durante a troca os limites caem para o IP do socket (nunca abrem).

## Passo a passo

```bash
# uma vez
railway login
railway link                       # projeto ogado, ambiente production

# serviço da API (o plano gratuito limita recursos: remova o Postgres duplicado antes, se existir)
railway add --service api \
  --variables 'DATABASE_URL=${{Postgres.DATABASE_URL}}' \
  --variables 'NODE_ENV=production' \
  --variables 'WEB_ORIGIN=https://ogado.vercel.app' \
  --variables 'TRUST_PROXY=100.64.0.0/10' \
  --variables "PROXY_SECRET=$(openssl rand -hex 32)"
railway domain --service api       # gera https://<nome>.up.railway.app

# a cada entrega (a partir da raiz do monorepo)
railway up --service api
```

As migrações rodam só pelo deploy (`prisma migrate deploy` no `CMD`); nunca aplique migração manualmente no banco do Railway. Migrações são aditivas (ADR-0011); destrutivas exigem ADR.

## Conectar o site (Vercel)

Defina `API_ORIGIN=https://<domínio público da API>` nas variáveis do projeto da Vercel e faça novo deploy: `apps/web/next.config.ts` passa a reescrever `/api/*` para a API. Defina também `PROXY_SECRET` (o mesmo do Railway).

## Verificação

```bash
API=https://<domínio público da API>
curl -s $API/health
# cadastro + sessão + lote (Origin precisa estar em WEB_ORIGIN)
curl -s -c jar -X POST $API/auth/signup -H 'Origin: https://ogado.vercel.app' \
  -H 'Content-Type: application/json' -d '{"email":"voce@exemplo.com","senha":"Senha#Forte1"}'
curl -s -b jar -X POST $API/lotes -H 'Origin: https://ogado.vercel.app' -H 'Content-Type: application/json' \
  -d '{"id":"<uuid>","tipo":"compra","categoria":"NOVILHO","modo":"medio","qtd":"10","peso":"200","preco":"300"}'
```

Como o cookie é `__Host-` com `Secure`, o `curl` só o reenvia por HTTPS no domínio público.
