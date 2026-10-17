# ADR-0010 — Autenticação, sessão e isolamento por fazenda (T-04)

**Status:** aceito (aprovado pelo pecuarista em 2026-10-17; respostas Q1–Q4, Q6 e Q7 abaixo) · **Data:** 2026-10-17

> **Decisões do humano:** **Q1** senha com **no mínimo 8 caracteres e obrigatoriamente ao menos 1 letra maiúscula, 1 número e 1 símbolo** (divergiu da recomendação de 12 caracteres sem regra de composição; máximo continua 128). **Q2** sessão de 30 dias sem uso, teto de 90. **Q3** sem verificação de e-mail na v1. **Q4** mensagem "Não foi possível criar a conta com este e-mail. Já tem conta? Entrar". **Q6** sem bloqueio de conta, só rate limit. **Q7** sem "Sair de todos os aparelhos" na v1.
**Requisitos:** RF-001 (e-mail/senha), RF-002 (sessão/logout), RF-010, RNF-003, RNF-004, RF-078, RF-080 · **Relacionados:** ADR-0002, ADR-0003, ADR-0007, ADR-0009

## Contexto
API Fastify separada do Next (ADR-0002), PWA offline-first (ADR-0007): sessão só em cookie HttpOnly, nada de token no aparelho, sessão expirada offline não pode perder a fila. T-16 acrescenta Google OAuth e reset de senha. A constituição exige argon2id, rate limit, logs sem PII e isolamento por `fazendaId` com teste.

Estado das bibliotecas pesquisado em 2026-10-17 (npm registry e sites oficiais):
- **Lucia**: descontinuada como biblioteca (mar/2025); o projeto agora publica um arquivo de referência para copiar (token `id.secret`, só o hash SHA-256 do segredo no banco, comparação em tempo constante, expiração deslizante, CSRF por `Sec-Fetch-Site`).
- **Better Auth** 1.7.10: ativa; integra no Fastify como rota coringa convertida para `Request` (Fetch API); hash padrão **scrypt** (argon2id só por função própria); CSRF por Origin + `trustedOrigins`; rate limit embutido; adaptador Prisma via `generate`; IDs configuráveis. 17 dependências diretas, inclui pacote de telemetria.
- **Auth.js**: incorporado à Better Auth (set/2025), em modo manutenção; o próprio time recomenda Better Auth para projetos novos. Sem integração oficial para Fastify.
- **@fastify/secure-session** 8.4.1: sessão sem estado (cookie cifrado, libsodium nativo). Não há revogação no servidor.
- **arctic** 3.7.0 (OAuth do mesmo autor da Lucia): **marcado como deprecated** no npm.
- **openid-client** 6.8.8 (panva): ativo, OIDC certificado; base para o Google no T-16.
- Suporte Fastify 5: `@fastify/cookie` 11.1.3, `@fastify/rate-limit` 11.2.1, `@fastify/helmet` 13.2.0 (helmet 8), `@fastify/csrf-protection` 8.0.2.
- Argon2: `@node-rs/argon2` 2.2.2 (binários pré-compilados por `optionalDependencies`, inclusive win32 x64/arm64, sem script de instalação); `argon2` 0.45.1 (node-gyp-build, exige script de instalação).

## Decisão

### (a) Sessão própria em Postgres com cookie opaco, no estilo Lucia, escrita à mão
1. **Token** = `idSessao.segredo`. ID com ≥ 80 bits e segredo com 256 bits, ambos de CSPRNG. No banco fica só o **SHA-256 do segredo**; a validação compara em tempo constante. Vazamento do banco não permite usar sessões.
2. **Cookie**: `HttpOnly`, `Secure` (fora do dev), `SameSite=Lax`, `Path=/`, sem `Domain`, prefixo `__Host-` em produção. Expiração do cookie = expiração da sessão.
3. **Ciclo de vida**: sessão nova a cada login e cadastro (evita fixação). Logout apaga a linha no servidor e o cookie. Expiração **deslizante por inatividade** com **teto absoluto**; `ultimaVerificacaoEm` só é gravado se a última gravação tiver mais de 1 h (economiza escrita). Valores: **[humano] Q2**; enquanto não houver resposta, a configuração fica em variáveis de ambiente.
4. **Interface do módulo (profundo, interface pequena)**: criar sessão, validar token (devolve usuário e fazenda ou "inválida/expirada"), invalidar sessão, invalidar todas as sessões do usuário (usada no T-16 quando a senha for trocada). Rotas só conhecem essa interface.
5. **Topologia de origens** (vale quando a hospedagem for decidida): o preferido é **mesma origem**, com o web repassando `/api/*` para o Fastify por proxy reverso; o aceitável é **mesmo site**, em subdomínios do mesmo domínio registrável. Domínios diferentes ficam **proibidos**, porque o ITP do Safari bloqueia o cookie e o PWA no iOS perde a sessão. Em dev, `localhost:3000` → `localhost:3001` já é mesmo site. Com proxy, a API usa `trustProxy` restrito ao proxy conhecido para ler o IP real.

**Alternativas rejeitadas**
- *Better Auth*: é a candidata mais forte. Foi rejeitada para a v1 por quatro motivos. (1) Exige substituir o scrypt para cumprir a constituição. (2) As rotas ficam fora do `fastify-type-provider-zod` e de `packages/contracts`, com formato de erro próprio, o que fere "Zod nas bordas" e o envelope único de erro. (3) Impõe esquema próprio (user/session/account/verification) e seu próprio rate limiter. (4) Traz superfície e dependências demais para 1 usuário por fazenda. **Reavaliar** se a v1.1+ pedir 2FA, passkeys ou equipe multiusuário.
- *Auth.js*: em manutenção, centrado no Next, sem Fastify.
- *@fastify/secure-session*: sem revogação. Logout e "sair de todos os aparelhos" não invalidam um cookie vazado. Também traz dependência nativa (sodium).
- *Lucia como pacote*: descontinuada. Adotamos o padrão dela, não a dependência.
- *JWT em cookie*: mesma falta de revogação, e não traz ganho com uma API única.

**Extensão para o T-16 (sem retrabalho)**
- Google: `openid-client` (Authorization Code + PKCE, `state` e `nonce`), com tabela `IdentidadeExterna` (provedor, `sub`, usuário). Ao final, o fluxo cria a mesma sessão deste ADR. Vincular um Google a uma conta já existente por e-mail depende da Q5.
- Reset de senha: tabela `TokenRedefinicao` com o hash SHA-256 do token, validade curta, uso único e rate limit. Ao redefinir, todas as sessões do usuário são invalidadas. A resposta é sempre neutra ("se o e-mail existir, enviaremos o link"). O provedor de e-mail fica para um ADR do T-16.

### (b) Hash de senha: argon2id com `@node-rs/argon2`
- Pacote `@node-rs/argon2`: tem binário pronto para Windows, Linux (glibc/musl) e macOS e não precisa de `allowBuilds` no pnpm 11 (ADR-0009). `argon2` fica rejeitado só por exigir script de build.
- Parâmetros **explícitos**, sem confiar no padrão da biblioteca. O mínimo recomendado pela OWASP é **m = 19 MiB (19456 KiB), t = 2, p = 1**. Adotamos esse valor, configurável por ambiente, e ele só pode subir. Salvamos a string PHC completa (com parâmetros e sal) e fazemos rehash transparente no login quando os parâmetros mudarem.
- Senha com no máximo 128 caracteres, verificado antes do hash para evitar DoS por senha longa, e sem truncar. Regra de composição decidida pelo humano (Q1): mínimo 8 caracteres, com ao menos 1 maiúscula, 1 número e 1 símbolo; mensagens de falha em pt-BR indicam qual regra falhou.
- Login com e-mail inexistente verifica um hash fictício, para igualar o tempo de resposta.

### (c) Modelo de dados mínimo
| Entidade | Campos essenciais | Sincronizável? |
|---|---|---|
| **Usuario** | `id` UUID (servidor), `email` único normalizado (trim + minúsculas), `senhaHash` (nulo quando o usuário só entra com Google no T-16), `criadoEm`, `atualizadoEm` | Não |
| **Sessao** | `id` (parte pública do token), `segredoHash`, `usuarioId`, `criadaEm`, `ultimaVerificacaoEm`, `expiraEm` (teto absoluto) | Não |
| **Fazenda** | `id` UUID, `donoId` **único** (1 fazenda por conta), `nome` (opcional até o onboarding do T-05), `version`, `createdAt`, `updatedAt`, `deletedAt` | **Sim** (configurações editáveis offline no T-05/T-14) |

- **Sem `Membro` na v1**: equipe multiusuário está fora do escopo (simples primeiro). Para várias fazendas na v1.1, basta remover a unicidade de `donoId`. `Membro` entra quando houver equipe.
- O **cadastro** cria Usuario + Fazenda + Sessao numa única transação. O tenant existe desde o primeiro acesso, e o onboarding (T-05) só preenche a fazenda.
- **Convenção de entidade sincronizável**, aplicada a toda entidade de negócio a partir de agora:
  - `id` UUID, validado como UUID. É **gerado no cliente** para entidades criadas no aparelho (Lote, Cenario) e pelo servidor apenas para a Fazenda, porque o cadastro é online.
  - `version` inteiro começando em 1. Só o servidor o incrementa, a cada mutação aceita.
  - `updatedAt` vem do **relógio do servidor**, com precisão de ms. O valor enviado pelo cliente é ignorado, porque o campo é o cursor do pull.
  - `deletedAt` nulo, ou preenchido como lápide (tombstone).
  - `fazendaId` com FK, índice `(fazendaId, updatedAt)` e PK global.
  - `mutationId` e a tabela de idempotência ficam para o ticket de sincronização. No T-04 a convenção é documentada e testada na Fazenda.
  - **Colisão de UUID entre fazendas**: um id que já existe em outra fazenda é recusado com erro genérico. O registro alheio nunca é sobrescrito nem revelado.

### (d) Imposição do tenant em toda query
1. Um hook de autenticação resolve o **contexto de tenant** (`usuarioId`, `fazendaId`) a partir da sessão e o anexa à requisição. Rota de negócio sem contexto responde 401.
2. **Repositórios por agregado** recebem o contexto de tenant como parâmetro obrigatório e escopam toda leitura e escrita por `fazendaId`. Isso inclui `update`/`delete`, que usam `where` composto (`id` + `fazendaId`), e contagens. As rotas não importam o cliente Prisma; uma regra de lint restringe a importação do pacote de banco aos repositórios e ao módulo de sessão.
3. Registro de outra fazenda responde **404**, nunca 403, para não confirmar que o registro existe.
4. **Teste de isolamento obrigatório** (seam: rotas HTTP com Postgres real), com duas fazendas, A e B. Para cada rota autenticada, o usuário A tenta ler, listar, alterar e excluir dados de B, e nada vaza nem muda. Um **teste-guardião** enumera as rotas registradas no Fastify e falha se alguma rota autenticada não estiver coberta pela suíte de isolamento, assim uma rota nova não escapa.
- *Rejeitado agora*: **RLS do Postgres** com `SET LOCAL`. Com o adapter `pg`, ele exige uma transação por requisição e complica o pool. Fica anotado como defesa em profundidade para a v1.1. Também rejeitada a **extensão do Prisma que injeta `fazendaId`** sozinha: é mágica, não cobre `$queryRaw` nem escritas aninhadas e esconde o contrato.

### (e) Endpoints, erros e defesas
- **Endpoints** (contratos Zod em `@ogado/contracts`):
  - `POST /auth/signup`: cria a conta e a sessão (201).
  - `POST /auth/login`: 200, ou 401 `credenciais_invalidas`.
  - `POST /auth/logout`: 204, idempotente.
  - `GET /auth/session`: 200 com usuário e fazenda, ou 401.
- **Envelope único de erro** `{ erro: { codigo, mensagem } }` via `setErrorHandler`:
  - Validação Zod → 400 com o caminho dos campos, nunca os valores.
  - 401 `nao_autenticado` / `sessao_expirada`.
  - 404 `nao_encontrado`.
  - 409 `conflito`.
  - 429 `muitas_tentativas` com `Retry-After`.
  - Qualquer outro erro → 500 `erro_interno`, com `requestId`, sem stack nem mensagem do Prisma.
  - E-mail inexistente e senha errada dão a mesma resposta, o mesmo status e tempo equivalente.
- **Logs sem PII**: `redact` em `password`, `senha`, `cookie`, `set-cookie`, `authorization` e `email`, além de qualquer corpo de `/auth/*`.
- **Rate limit** (`@fastify/rate-limit`):
  - Global moderado.
  - Login: chave IP + e-mail normalizado, ~5/min, e só IP, ~20/min.
  - Cadastro: ~5/h por IP.
  - Armazenamento em memória enquanto houver uma instância; Postgres/Redis quando escalar (depende da hospedagem). Números ajustáveis por ambiente.
- **CSRF sem token sincronizador**, com quatro barreiras somadas:
  - `SameSite=Lax`.
  - Métodos inseguros exigem `Origin` na lista permitida (igual a `WEB_ORIGIN`).
  - `Sec-Fetch-Site`, quando presente, tem de ser `same-origin` ou `same-site`.
  - `Content-Type: application/json` é obrigatório, o que força preflight CORS entre origens.
  - GET nunca altera estado.
  - *Rejeitado*: `@fastify/csrf-protection` (double-submit). Ele exige token legível por JS e renovação, e isso atrita com o offline e não acrescenta proteção diante das barreiras acima.
- **Helmet** (`@fastify/helmet`): a API só serve JSON, então usa CSP `default-src 'none'; frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer` e HSTS em produção. A CSP do web fica com o Next (ticket de UI).
- **CORS**: lista exata de origens e `credentials: true`. Nunca `*`.

### (f) Estados da sessão para o front (RF-078, RF-080)
| Estado | Como se detecta | Comportamento |
|---|---|---|
| `autenticado` | `GET /auth/session` responde 200 | Uso normal; a fila sincroniza |
| `anonimo` | 401 sem identidade local salva | Tela de login |
| `offline-nao-verificado` | Sem rede, com identidade local (`usuarioId` + `fazendaId`, que não são segredo) | Uso local completo; a fila acumula; nada é apagado |
| `expirada` | 401 (de sessão ou sync) com identidade local | Uso local continua; aviso "Entre de novo para enviar N lançamentos"; a fila **fica intacta**; sync pausada |
- 401 **nunca** dispara limpeza local. Só o logout explícito ou a troca de usuário apagam o banco local (RF-078).
- Novo login com o **mesmo** `usuarioId`: a fila é retomada. Com **outro** usuário e pendências do anterior, o app avisa e só apaga com confirmação ("N lançamentos de outra conta ainda não foram enviados").
- O service worker nunca cacheia `/auth/*` nem respostas autenticadas (ADR-0007).

## Perguntas ao humano (bloqueiam só os valores, não a arquitetura)
| # | Pergunta | Recomendação |
|---|---|---|
| Q1 | Qual o comprimento mínimo da senha? A OWASP/NIST pedem 15 sem MFA e 8 com MFA; a v1 não tem MFA. | **12 caracteres**, sem regra de composição, aceitando espaço e acento, com bloqueio das senhas mais comuns (lista local) e indicador de força. 15 atrapalha no celular; 8 é fraco sem MFA. |
| Q2 | Quanto tempo a sessão dura? A OWASP sugere 15–30 min de inatividade para web comum, o que é inviável no curral offline. | **30 dias de inatividade** (renovação deslizante) e **teto absoluto de 90 dias**. O risco aceito é um aparelho perdido com sessão aberta. |
| Q3 | Haverá verificação de e-mail na v1? | **Não na v1** (o provedor de e-mail só chega no T-16). Reavaliar no T-16. |
| Q4 | O que dizer no cadastro com e-mail já existente? Sem verificação, não dá para evitar que alguém descubra se o e-mail está cadastrado. | Mensagem "Não foi possível criar a conta com este e-mail. Já tem conta? Entrar", mitigada por rate limit. Com a verificação (Q3), passa a ser uma resposta neutra. |
| Q5 | (T-16) Ao entrar com Google usando um e-mail que já tem conta por senha: vincular sozinho ou pedir a senha? | Vincular automaticamente **só** se o Google marcar o e-mail como verificado. |
| Q6 | Bloquear a conta depois de N senhas erradas? | **Não**: só rate limit por IP + e-mail. Bloqueio permite que um terceiro tranque a conta do pecuarista de propósito (DoS). |
| Q7 | Haverá "Sair de todos os aparelhos" na v1? | Não na UI da v1. Redefinir a senha (T-16) já invalida todas as sessões. |

## Consequências
- Cerca de 300 linhas de código de auth sob nossa responsabilidade. A mitigação é uma interface pequena, a suíte do seam HTTP e a revisão pelo checklist ASVS L1 (RNF-003).
- O T-16 reaproveita sessão, erros e rate limit, e acrescenta duas tabelas e `openid-client`.
- A hospedagem precisa respeitar a topologia de mesma origem ou mesmo site. Isso vira requisito da decisão de hospedagem, que segue em aberto.
