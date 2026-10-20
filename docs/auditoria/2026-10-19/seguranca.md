# Parecer de segurança — 19/10/2026

## Escopo e método

Revisão do estado atual do repositório, incluindo alterações locais existentes, orientada por `.claude/agents/code-reviewer.md`, `.claude/skills/code-review/SKILL.md`, `.claude/skills/zod-contracts/SKILL.md`, `CLAUDE.md`, `GLOSSARY.md`, `docs/sdd/constitution.md`, requisitos e ADR-0010. O escopo pedido é a aplicação inteira; portanto a revisão não foi limitada a um diff. Não foram alterados código de produção, fórmulas, migrações ou configurações de implantação.

Foram usados três tipos de evidência:

1. Probes HTTP com `Fastify.inject`, aplicação real e adaptadores falsos. Nenhum servidor, banco, serviço de e-mail ou Google externo é utilizado por esses probes.
2. Prova de ciclo de recuperação com PostgreSQL real isolado, executada pelo agente de integração.
3. Inspeção de código e varredura heurística de arquivos rastreados. Achados estáticos e hipóteses não são apresentados como exploração em produção.

Artefatos reproduzíveis:

- [Probes de segurança e resultados](security-probes.json); runner: `.scratch/auditoria-2026-10-19/security-probes.ts`.
- [Prova de reset após mudança de e-mail/senha](evidencias/integracao-reset-probe.json); runner: `.scratch/auditoria-2026-10-19/integracao-reset-probe.ts`.
- [Varredura de segredos](tracked-secret-scan.json); runner: `.scratch/auditoria-2026-10-19/scan-tracked-secrets.mjs`.

Comandos: `apps\api\node_modules\.bin\tsx.cmd .scratch/auditoria-2026-10-19/security-probes.ts` e `node .scratch/auditoria-2026-10-19/scan-tracked-secrets.mjs`, a partir da raiz. A execução do `tsx` precisou sair do sandbox porque o inicializador local falhou com `uv_os_get_passwd ENOMEM`; a prova aprovada continuou estritamente local e sem rede/banco. A suíte PostgreSQL, auditoria de dependências e navegador são contabilizados no parecer geral, evitando somar novamente os mesmos testes.

## Parecer

**Recomendo corrigir SEC-02, SEC-03 e SEC-04 antes de aprovar a segurança para publicação.** Os controles de sessão, autenticação obrigatória, CSRF e CORS têm boa implementação e passaram pelos probes descritos; o limite global anunciado não está ativo, e o ciclo de recuperação conserva credenciais antigas e admite tokens concorrentes. SEC-01 exige endurecimento no tratamento dos erros de e-mail, sem evidência de vazamento real do provedor atual. A auditoria de dependências também identificou três avisos transitivos no Lodash (SEC-05), cujo alcance em produção precisa ser avaliado.

| ID | Severidade de revisão | Evidência | Resultado |
|---|---|---|---|
| SEC-01 | Ajusta — média | Runtime, adaptador sintético | Mensagem arbitrária de falha do adaptador chega ao log, inclusive e-mail/token sintéticos. |
| SEC-02 | Bloqueia — alta para disponibilidade | Runtime, app real sem banco | Configuração global `max=2`: terceira chamada de `/health` responde 200, sem cabeçalhos do limitador. |
| SEC-03 | Bloqueia — alta | Runtime, PostgreSQL real isolado | Token emitido antes de trocar e-mail/senha ainda redefine a senha e permite login. |
| SEC-04 | Bloqueia — alta, associada ao ciclo de recuperação | Runtime, PostgreSQL real isolado | Duas emissões concorrentes deixam dois tokens resgatáveis, inclusive após o primeiro reset. |
| SEC-05 | Ajusta — 1 aviso alto e 2 moderados do scanner | `pnpm audit` com registry acessível | Lodash 4.17.21 em cadeia Prisma Studio/visx; exploração pela aplicação não foi demonstrada. |

## Standards

### SEC-01 — erros assíncronos de e-mail escapam da sanitização de logs

**Fontes:** `apps/api/src/routes/auth.ts:158`, `apps/api/src/routes/conta.ts:231`, `apps/api/src/app.ts:54`. O envelope global já usa um caminho mais seguro em `apps/api/src/plugins/error-handler.ts:32`, mas esses dois `catch` registram `error.message` diretamente no campo `motivo`. A lista de `redact` não trata conteúdo embutido nesse campo.

**Regra:** constituição §13 (`docs/sdd/constitution.md:17`), RNF-008 (`docs/negocio/02-requisitos.md:86`), ADR-0010 (`docs/adr/0010-autenticacao-e-sessao.md:89`) e compromisso de logs sem e-mail/senha/cookie (`docs/legal/politica-de-privacidade.md:37`).

**Prova:** injetar um `EmailSender` que rejeita com uma mensagem contendo e-mail e token exclusivamente sintéticos; `POST /auth/senha/esqueci` permanece 202, mas os dois marcadores aparecem nos logs. O artefato registra somente booleanos, sem conteúdo secreto. O sink de reset foi executado; o sink equivalente de exportação foi confirmado por inspeção.

**Limite:** o adaptador Resend atual (`apps/api/src/email/resend-sender.ts:35`) produz mensagem fixa com status em falhas HTTP. A prova demonstra uma fronteira de logging insegura, não um vazamento observado do Resend em produção. Falhas futuras de adaptador/provedor podem introduzir conteúdo sensível.

**Correção sugerida:** usar categorias fixas de falha ou o logger sanitizado existente; nunca registrar mensagens arbitrárias do adaptador. Acrescentar teste de não vazamento aos dois caminhos assíncronos.

### SEC-02 — registro tardio desativa o rate limit global

**Fontes:** `apps/api/src/app.ts:123`, `apps/api/src/app.ts:127`, `apps/api/src/plugins/rate-limit.ts:40`. O plugin é enfileirado por `app.register`, mas as rotas são registradas sincronicamente no mesmo `buildApp`. A implementação instalada de `@fastify/rate-limit` instala o limite automático por `onRoute` (`apps/api/node_modules/@fastify/rate-limit/index.js:172`); quando esse hook é instalado, as rotas da aplicação já foram declaradas.

**Regra:** constituição §13; RNF-003 (`docs/negocio/02-requisitos.md:81`); ADR-0010, seção de rate limit global e controles de abuso (`docs/adr/0010-autenticacao-e-sessao.md:90`).

**Prova:** construir o aplicativo com `global.max=2`, janela de 60 s e fazer três requisições consecutivas de `/health` do mesmo IP. A terceira responde **200**, sem `x-ratelimit-limit`. O comportamento foi reproduzido com o banco substituído apenas para eliminar I/O. A rota real e o plugin real são usados.

**Impacto:** o teto global configurado não protege leituras, health checks nem outros caminhos que dependem dele. `/health` normalmente consulta o banco, de modo que requisições repetidas podem consumir recursos sem o teto anunciado. Não foi feita carga abusiva nem demonstrada indisponibilidade real.

**Distinção:** os limitadores nomeados chamados explicitamente pelos handlers permanecem ativos: `loginIp.max=2` produziu **401 / 401 / 429**, com `Retry-After`. Não é correto afirmar que login/reset/cadastro estão totalmente sem limite.

**Correção sugerida:** registrar as rotas após concluir o registro dos plugins, usando um plugin de rotas ou uma fábrica assíncrona; alternativamente aplicar explicitamente o hook global. Acrescentar uma prova HTTP que configure limite baixo e ultrapasse esse limite em uma rota comum. Manter a política de store em memória apenas enquanto houver uma instância, conforme ADR-0010.

### SEC-03 — mudanças de credenciais não revogam recuperação pendente

**Fontes:** `apps/api/src/routes/conta.ts:65`, `apps/api/src/routes/conta.ts:121`, `apps/api/src/repositories/account-repository.ts:133`, `apps/api/src/repositories/account-repository.ts:202`, `apps/api/src/repositories/account-repository.ts:183`. `updatePerfil` e `updateSenhaHash` não invalidam `TokenRedefinicao`; o resgate confere apenas hash, uso e validade.

**Regra:** RF-002, segurança do ciclo de recuperação; RNF-003. RF-004/RF-005 descrevem a edição de perfil e senha, mas não definem literalmente a revogação dos tokens. Assim, trata-se de risco de segurança confirmado e lacuna de política, não de um requisito inventado de RF-004.

**Prova com PostgreSQL isolado:**

| Etapa | Mudança de e-mail | Mudança de senha |
|---|---:|---:|
| Emitir recuperação | 202 | 202 |
| Alterar o dado autenticado | 200 | 204 |
| Resgatar token emitido anteriormente | **204** | **204** |
| Login com a senha definida pelo token anterior | **200** | **200** |

**Impacto:** quem detenha um token emitido para o endereço anterior ou obtido antes da troca de senha conserva capacidade de redefinir a senha até o vencimento de uma hora. A troca de credenciais deixa de encerrar essa forma de acesso. A prova utilizou somente contas de teste e não indica comprometimento de usuários reais.

**Correção sugerida:** tornar transacionais as mudanças relevantes e a revogação dos tokens pendentes. Revogar recuperação anterior ao trocar senha ou e-mail; definir explicitamente a política para resgate bem-sucedido e para emissões concorrentes; testar esses fluxos em PostgreSQL. A necessidade de confirmação do novo e-mail/reauth para operações sensíveis deve virar requisito/ADR, pois muda decisões já aceitas no produto.

### SEC-04 — emissão concorrente cria mais de uma recuperação ativa

**Fontes:** `apps/api/src/repositories/account-repository.ts:157`, `apps/api/src/repositories/account-repository.ts:161`, `apps/api/src/repositories/account-repository.ts:183`. A transação primeiro marca tokens existentes como usados, depois cria o novo, sem serializar por usuário. Duas transações podem executar o primeiro passo antes de qualquer uma inserir seu token. O resgate invalida somente o token apresentado, não os outros tokens pendentes do mesmo usuário.

**Prova com PostgreSQL real:** uma única tentativa de duas chamadas concorrentes a `POST /auth/senha/esqueci` na mesma conta respondeu **202 / 202** e gerou dois e-mails. Seus tokens foram resgatados em sequência e ambos responderam **204 / 204** (`multipleTokensUsable: true` em `integracao-reset-probe.json`). Não foi necessário aumentar carga nem repetir a corrida.

**Regra e impacto:** RF-002/RNF-003; contraria a intenção explícita do próprio repositório de invalidar recuperação anterior. Não viola literalmente “uso único” de cada token, pois cada um foi consumido uma vez; a falha é haver mais de uma credencial ativa e uma delas sobreviver ao reset da outra. Isso amplia a exposição de SEC-03 caso algum link anterior seja comprometido.

**Correção sugerida:** serializar emissão por usuário com uma estratégia de concorrência explícita e revogar todos os tokens pendentes no reset bem-sucedido dentro da mesma transação. Validar com prova concorrente em PostgreSQL, preservando resposta neutra e limites de envio.

### SEC-05 — três avisos de dependência transitiva no Lodash

**Evidência:** [resultado completo do registry](evidencias/dependency-audit-network.txt), obtido por `pnpm audit --json` com acesso de rede. **581 dependências totais**, **1 aviso alto**, **2 moderados**, nenhum crítico. Todos apontam para **Lodash 4.17.21**, via `@prisma/client > prisma > @prisma/studio-core > @visx/* > lodash` e via `prisma > @prisma/studio-core > @visx/* > lodash`.

| Advisory | Tipo | Severidade reportada |
|---|---|---|
| [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc) | Injeção de código por nomes de imports em `_.template` | Alta |
| [GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh) | Prototype pollution por caminhos em array de `_.unset`/`_.omit` | Moderada |
| [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) | Prototype pollution em `_.unset`/`_.omit` | Moderada |

**Alcance:** os avisos são três entradas de advisory sobre uma dependência transitiva; não equivalem a três explorações comprovadas no produto. A cadeia inclui ferramentas do Prisma Studio. Embora o audit marque essa árvore como não exclusivamente dev, não foi demonstrado que os métodos vulneráveis recebam entradas não confiáveis nos handlers da API.

**Ação:** atualizar a cadeia Prisma/Lodash para versão mantida e corrigida, confirmar o lockfile e repetir testes de integração/build; verificar o que é efetivamente empacotado na imagem. O registry e o advisory podem divergir no número mínimo corrigido; não aplicar um mínimo antigo de forma automática nem forçar override sem verificar compatibilidade. Não foi feita alteração de dependências durante a auditoria.

## Spec

- **RNF-003:** cobertura parcial aprovada. Cookies e defesas CSRF/CORS estão consistentes com ADR-0010; o rate limit global falha no runtime (SEC-02). Não foi feita certificação completa OWASP ASVS L1.
- **RNF-004:** o probe enumera o catálogo de rotas protegidas e exige 401 sem sessão para cada método/rota. Isso verifica ausência de abertura acidental; o isolamento A/B com PostgreSQL é evidência separada do agente de integração. Repositórios de negócio inspecionados usam o `fazendaId` da sessão. Consultas globais de identidade/colisão são internas e não foram confundidas com um vazamento HTTP.
- **RNF-008:** tratamento global evita mensagem de ORM e valores dos corpos, mas os dois sinks assíncronos de e-mail não garantem a mesma regra (SEC-01).
- **RF-002/RF-005:** uso único transacional de cada token e revogação de sessões no reset estão implementados; tokens anteriores às mudanças de credenciais continuam utilizáveis (SEC-03), e a concorrência admite dois links ativos (SEC-04).
- **RF-006:** fluxo Google contém state, nonce, PKCE S256, assinatura/issuer/audience e e-mail verificado; vínculo exige conta autenticada, e desvínculo exige senha definida. Essas observações são de código e das suítes com seam falso; nenhum login no Google real foi realizado nesta revisão.
- **RNF-014:** identidade local armazena somente IDs, SW ignora `/api/*`, e controladores preservam fila ao expirar sessão. A eficácia de logout/troca de usuário no navegador é aferida na suíte E2E do parecer geral.
- **Skill Zod:** existe divergência documental: `.claude/skills/zod-contracts/SKILL.md` pede 422 para validação, enquanto ADR-0010 e a implementação/testes usam 400. Recomenda-se alinhar a skill ao ADR aceito; não alterar o contrato HTTP apenas para satisfazer a skill antiga.

## Controles exercitados

O JSON traz cada caso e status: **40 controles aprovados e 2 achados reproduzidos** na execução em memória, além de **3 fluxos problemáticos** na prova PostgreSQL de recuperação. Foram exercitados: Origin ausente e maliciosa; `Sec-Fetch-Site: cross-site`; conteúdo de formulário; JSON inválido; chave `__proto__`; corpo acima de 64 KiB; validação Zod; autenticação obrigatória em todas as **26 rotas/métodos protegidos** do catálogo; CSP/nosniff/no-referrer da API; preflight CORS de origem exata e rejeição de origem estranha; resposta neutra de recuperação mesmo com falha de e-mail; HSTS em produção; limitador nomeado e `Retry-After`. Os achados foram registrados separadamente de controles aprovados.

Varredura de segredos: **434 arquivos rastreados**, quatro famílias de padrões (AWS access key, chave privada, tokens de serviços conhecidos, URL de banco remoto com senha), **zero detecções**. `.env` e `.env.local` estão ignorados e não constam da lista rastreada. Não foram exibidos valores desses arquivos. Esse resultado não certifica ausência de qualquer segredo e não cobre histórico Git, arquivos ignorados, infraestrutura ou todos os formatos de credenciais.

## Recomendações arquiteturais e validações adicionais

1. **Ordem de inicialização explícita:** resolver plugins antes de registrar rotas e validar defesas por comportamento HTTP. SEC-02 mostra que configuração declarada e testes de limitadores manuais não comprovam o teto automático.
2. **Uma operação de segurança por transação:** concentrar atualização de senha/e-mail, revogação de recuperação e política de sessões numa fronteira de conta. Evita que cada handler lembre de partes diferentes do ciclo de credenciais. Aplicar primeiro ao segundo uso real existente; não requer framework genérico de auth.
3. **Logs por categorias:** padronizar sinks assíncronos no mesmo caminho sanitizado já usado para erro interno. Testes devem cobrir mensagens maliciosas vindas de adaptadores, e não só exceções de Prisma.
4. **Cabeçalhos do HTML:** `apps/web/next.config.ts` e `apps/web/app/layout.tsx` não configuram CSP, `frame-ancestors` ou política explícita de referrer. Helmet da API não protege o HTML do Next. A prova HTTP de desenvolvimento ([headers](evidencias/web-headers.json), `GET /entrar` em porta local 3102, status 200) retornou `Cache-Control: no-store`, mas não retornou CSP, `X-Frame-Options`, `Referrer-Policy` ou `X-Content-Type-Options`. HSTS também estava ausente, o que é esperado em HTTP local e não foi classificado como falha. O dado de desenvolvimento não comprova os cabeçalhos do ambiente publicado: confirmar produção/CDN e definir política compatível com fontes/PWA. É lacuna de hardening; não há XSS confirmado nesta revisão.
5. **Cache de dados autenticados:** somente a exportação declara `Cache-Control: no-store` (`apps/api/src/routes/conta.ts:205`). Aplicar política explícita de não cache a sessão/dados privados e verificar o proxy/CDN. O SW já ignora `/api`; essa defesa não controla caches intermediários. Não foi provado vazamento por cache.
6. **Confiança do proxy:** `apps/web/proxy.ts:16` aceita `x-real-ip` ou o primeiro `x-forwarded-for` e os reenvia com segredo. A proteção depende de a borda realmente substituir esses cabeçalhos. Validar a implantação Vercel/Railway com pedidos externos; não assumir IP autêntico só porque o segundo salto é assinado. Não houve prova de spoofing na infraestrutura real.
7. **Histórico de sincronização:** `packages/contracts/src/historico-sync.ts:3` aceita snapshots como JSON genérico; `apps/api/src/repositories/historico-sync-repository.ts:21` persiste conteúdo enviado pelo próprio usuário, após verificar entidade/tenant. Não tratar esse conteúdo como trilha de auditoria de segurança confiável. Definir schema de snapshot por entidade, retenção/quota por fazenda e limites de complexidade. O bodyLimit limita uma requisição, mas não o crescimento cumulativo; o histórico tem paginação de 100 itens.
8. **Dependências e implantação:** considerar o resultado de `pnpm audit` do parecer geral. Separar vulnerabilidade com alcance demonstrado de alerta transitivo sem uso no runtime. Antes de múltiplas instâncias, migrar store de rate limit conforme ADR-0010 e revisar limites de pool/conexões.

## Complemento: cabeçalhos do build de produção local

O agente principal também aferiu `GET /entrar` no Next após `next build` + `next start`, `NODE_ENV=production`, porta 3104: HTTP 200, sem CSP, `X-Frame-Options`, `Referrer-Policy` e `X-Content-Type-Options`; `Cache-Control: s-maxage=31536000`. Evidência: [web-headers-production.json](evidencias/web-headers-production.json). Isso confirma a ausência dos cabeçalhos nesse build local. A página pública de entrada não foi confundida com dados autenticados nem esse cache foi classificado como vazamento. HSTS continua fora dessa prova por se tratar de HTTP localhost; a CDN/HTTPS publicada pode acrescentar políticas próprias e não foi testada.

## Limites do parecer

Não foram realizadas requisições contra produção, descoberta de serviços públicos, testes destrutivos, brute force real, entrega de e-mail, autenticação Google real, revisão completa da nuvem/IAM/TLS/CDN ou auditoria legal. Não foi executada ferramenta dedicada de detecção de segredos em todo o histórico Git. A revisão e os probes reduzem incerteza nos controles exercitados; não garantem ausência de vulnerabilidades. Números das suítes funcionais, integração, desempenho, dependências e E2E estão no relatório principal.
