# Parecer de integração, API e isolamento por fazenda — 19/10/2026

## Resultado

**A suíte existente da API passou integralmente: 195 testes, 22 arquivos, nenhum teste pulado ou falho.** O resultado usa PostgreSQL real 17.11, com as oito migrações aplicadas em banco novo e isolado. Os probes adicionais encontraram problemas de segurança que a suíte existente não cobre: tokens de recuperação continuam válidos após alterar o e-mail ou a senha; duas emissões concorrentes também produziram dois tokens resgatáveis.

Execução orientada por `.claude/agents/test-engineer.md`, `.claude/agents/backend-engineer.md`, `.claude/skills/tdd/SKILL.md`, `CLAUDE.md`, `GLOSSARY.md` e `docs/sdd/constitution.md`. Somente fronteiras HTTP já previstas na especificação foram exercitadas; nenhum código de produção, fórmula, migration ou script existente foi modificado.

## Ambiente e proteção dos dados

- Docker Desktop foi iniciado; havia um container `ogado-dev-kit-postgres-1`, que foi preservado.
- Container exclusivo: `ogado-auditoria-20261019-integration`, imagem local `postgres:17-alpine`, PostgreSQL **17.11**.
- Banco: `ogado_auditoria_20261019`, em `127.0.0.1:55439`; dados em `tmpfs`, sem reutilização de volume. A URL foi definida explicitamente no processo; nenhum `.env` de produção foi carregado.
- As oito migrações foram aplicadas com `migrate deploy`, sem reset, drop ou acesso ao banco existente.
- O limite de memória do container foi reduzido para 512 MiB sem reinício; medição subsequente: 75,5 MiB, CPU 0,03%. Isso descreve o banco ocioso, não um benchmark.
- O container foi mantido disponível para os E2E coordenados pelo agente principal. Após a conclusão de todos os E2E e a liberação da coordenação, foi parado e removido com sucesso: identidade, banco, bind local e tmpfs foram conferidos antes; os comandos de inspeção, parada, remoção e verificação retornaram código 0. O container existente `ogado-dev-kit-postgres-1` permaneceu em execução. Nenhuma imagem ou volume existente foi removido. Evidência: [limpeza concluída](evidencias/integracao-limpeza.log).

## Comandos e resultados

Todos os comandos Node/Vitest foram executados com `NODE_ENV=test` e `DATABASE_URL` do banco temporário. Para o subprocesso `pnpm` do global setup foi necessário `pnpm_config_pm_on_fail=ignore`: o pacote instalado é 11.13.0 e o manifesto pede 11.13.1; a tentativa automática de obter e verificar a versão exigida falhou com o registry inacessível. Essa opção foi somente de processo e não alterou o lockfile nem a configuração do projeto.

| Verificação | Comando efetivo | Código | Resultado | Tempo |
|---|---|---:|---|---:|
| Migrações em banco vazio | `node packages/db/node_modules/prisma/build/index.js migrate deploy --config packages/db/prisma.config.ts` | 0 | 8 migrações aplicadas | 20,01 s de processo |
| API unitários explicitamente separados | Em `apps/api`: `node ../../node_modules/vitest/vitest.mjs run --config vitest.unit.config.ts --reporter=verbose --reporter=json` | 0 | 3/3 testes, 1 arquivo | 4,79 s Vitest; 9,61 s de processo |
| API completa | Em `apps/api`: `node ../../node_modules/vitest/vitest.mjs run --config vitest.config.ts --reporter=verbose --reporter=json` | 0 | 195/195 testes, 22 arquivos | 98,05 s Vitest; 107,07 s de processo |
| Probes de reset por HTTP e banco real | `node apps/api/node_modules/tsx/dist/cli.mjs .scratch/auditoria-2026-10-19/integracao-reset-probe.ts` | 0 | 3 cenários executados; vulnerabilidades reproduzidas | 1,34 s no runner; 6,75 s de processo |

Os três testes de `historico-sync.unit.test.ts` também integram a execução completa. **Total único da suíte API: 195**, e não 198. O probe adicional não é contabilizado como teste aprovado: código zero significa que conseguiu observar e registrar o comportamento.

Os testes foram executados com a concorrência padrão do projeto. Houve pressão de RAM no host durante verificações paralelas; os tempos desta execução não constituem baseline de performance nem validam um SLO.

## Inventário da suíte completa

Todos os arquivos abaixo passaram. Os números são de casos de teste; um caso pode executar várias requisições.

| Arquivo | Casos |
|---|---:|
| `auth-google.test.ts` | 29 |
| `auth-login.test.ts` | 3 |
| `auth-recuperar-senha.test.ts` | 19 |
| `auth-session.test.ts` | 5 |
| `auth-signup.test.ts` | 7 |
| `client-ip.test.ts` | 3 |
| `conta-aceite.test.ts` | 8 |
| `conta-exportar-email.test.ts` | 4 |
| `conta-exportar.test.ts` | 5 |
| `conta.test.ts` | 16 |
| `dados.test.ts` | 19 |
| `env.test.ts` | 20 |
| `fazenda-repository.test.ts` | 5 |
| `google-client.test.ts` | 9 |
| `health.test.ts` | 3 |
| `historico-sync.test.ts` | 1 |
| `historico-sync.unit.test.ts` | 3 |
| `isolation.test.ts` | 6 |
| `rate-limit.test.ts` | 3 |
| `security.test.ts` | 18 |
| `session-lifecycle.test.ts` | 5 |
| `storage.test.ts` | 4 |
| **Total** | **195** |

Os 18 testes de `security.test.ts` incluem CSRF por Origin/Sec-Fetch-Site/tipo de conteúdo, JSON malformado, resposta/log sem segredos, CSP, HSTS, CORS e cookie `__Host-` em configuração de produção. Os testes de rate limit exercitam os limites reais do aplicativo de teste; o harness relaxa limites para os outros testes para evitar interferência pelo IP compartilhado.

Os seis testes de isolamento incluem um caso que percorre a matriz de rotas autenticadas com fazendas A/B, cobertura automática de novas rotas, exigência de cookie e metatestes do guardião. Novas rotas públicas fora da allowlist falham; casos vazios sem tentativa/assertiva também falham. A suíte de dados complementa essa proteção com colisões de UUID, versionamento e isolamento de lotes/cenários/recria/histórico.

Google e Resend são exercitados com adaptadores de teste e respostas controladas. Não houve chamada real a esses provedores; a suíte não atesta configuração de credenciais, entregabilidade de e-mail ou disponibilidade externa.

## Achados adicionais reproduzidos

### INT-SEC-01 — token de recuperação persiste após mudanças de identidade e senha

**Prioridade alta.** No banco real, os dois cenários tiveram os seguintes resultados:

| Sequência | Solicitar link | Mudança autenticada | Resgatar link anterior | Login com a senha definida pelo link |
|---|---:|---:|---:|---:|
| Solicitar link e trocar e-mail | 202 | `PATCH /conta/perfil`: 200 | 204 | 200 |
| Solicitar link e trocar senha | 202 | `PUT /conta/senha`: 204 | 204 | 200 |

O detentor do link anterior mantém a capacidade de redefinir a senha até o token expirar, mesmo após o titular trocar o e-mail ou a senha. Isso é uma capacidade de comprometimento caso o link antigo esteja acessível a um terceiro; o probe não implica obtenção espontânea do token por um atacante.

Referências: `apps/api/src/repositories/account-repository.ts:133` (`updateSenhaHash`), `:202` (`updatePerfil`), `apps/api/src/routes/conta.ts:65` e `:121`. Recomenda-se uma operação transacional explícita para mudança de credenciais que invalide tokens pendentes. Rehash automático no login também usa `updateSenhaHash`; não se deve confundir rehash técnico com troca de senha ao introduzir a política de revogação.

### INT-SEC-02 — emissão concorrente produz dois links recuperáveis

**Prioridade alta para correção junto ao ciclo de vida de tokens.** Uma única tentativa com duas chamadas simultâneas de `POST /auth/senha/esqueci` para a mesma conta retornou 202/202 e enviou dois e-mails. Os dois tokens foram resgatados sequencialmente, ambos com **204**.

Referências: `apps/api/src/repositories/account-repository.ts:150` e `:177`. A transação que invalida os tokens existentes e cria outro não serializa a emissão por usuário; o resgate consome somente o token apresentado. Sugestão: serializar pelo usuário na transação, por exemplo com bloqueio da linha do usuário, e invalidar os demais tokens após redefinição bem-sucedida. Testar emissão simultânea e troca de e-mail/senha com tokens previamente emitidos. Nenhum ajuste foi aplicado nesta auditoria.

### INT-ARCH-01 — harness de testes não protege o destino do banco

**Prioridade alta para segurança operacional da engenharia.** `apps/api/test/support/env.ts:1` possui fallback para `localhost:5432/ogado`. O global setup em `apps/api/test/support/global-setup.ts:7` migra esse destino e no teardown apaga fazendas/usuários pelo sufixo de e-mail de teste. O `isolation-guard.ts` protege isolamento de tenant e cobertura de rotas; ele não valida que o banco é exclusivo de testes.

Recomendação: exigir `TEST_DATABASE_URL` explícito e validar host/database identificados como teste antes de qualquer migration ou limpeza. O CI deve criar e remover o banco por execução, sem fallback para o banco de desenvolvimento. Esta auditoria evitou a exposição fornecendo a URL isolada explicitamente e restringindo o probe ao host/porta/nome esperado.

## Limitações e melhorias arquiteturais

1. A API passou nos cenários existentes, mas o ciclo de vida de tokens exige ampliar a suíte: emissão concorrente, invalidade após mudança de e-mail e invalidade após mudança de senha. A cobertura positiva atual não sustenta afirmar ausência de falhas de segurança.
2. Para CI com poucos recursos, separar unitários de integração e limitar workers segundo RAM disponível; hash Argon2 e bancos reais tornam concorrência sem orçamento de memória cara. Não interpretar os 98,05 segundos como latência da API.
3. Manter os testes de integração com PostgreSQL real. O arquivo `historico-sync.unit.test.ts` usa doubles em memória; ele deve complementar o teste real `historico-sync.test.ts`, que também passou, sem substituí-lo.
4. Acrescentar pipeline que sobe Postgres efêmero, aplica migrações, verifica ausência de drift e executa a matriz de isolamento em cada PR. Não foi executado backup/restore nesta frente; migration bem-sucedida em banco vazio não prova recuperação de desastre nem upgrade com grandes volumes históricos.
5. Provedores externos necessitam smoke tests controlados em ambiente próprio; esses testes podem verificar integração real sem depender deles no gate determinístico de cada PR.

## Evidências

- [Isolamento do container, versão do PostgreSQL e contagem de migrações](evidencias/integracao-infraestrutura.log).
- [Limpeza final do recurso efêmero e preservação do container existente](evidencias/integracao-limpeza.log).
- [Migrações — log](evidencias/integracao-migracoes.log) e [tempo/código](evidencias/integracao-migracoes-execucao.json).
- [Unitários — JSON](evidencias/integracao-unitarios-direto.json), [log](evidencias/integracao-unitarios-direto.log) e [tempo/código](evidencias/integracao-unitarios-direto-execucao.json).
- [API completa — JSON bruto](evidencias/integracao-completa.json), [log detalhado](evidencias/integracao-completa.log), [resumo por arquivo](evidencias/integracao-completa-resumo.json) e [tempo/código](evidencias/integracao-completa-execucao.json).
- [Probes de recuperação — resultado sem tokens](evidencias/integracao-reset-probe.json) e [log](evidencias/integracao-reset-probe.log). Runner: `.scratch/auditoria-2026-10-19/integracao-reset-probe.ts`.

As primeiras tentativas encontraram: bloqueio de `pnpm.ps1` pela política de execução do PowerShell, bootstrap automático de versão do pnpm sem acesso ao registry, Docker inicialmente desligado e restrição do sandbox à identificação do usuário Windows exigida pelo `tsx`. As alternativas foram `pnpm.cmd`, binários Node já instalados, configuração `pnpm_config_pm_on_fail=ignore` de processo e execução autorizada fora do sandbox para Docker/tsx. Esses bloqueios foram superados; nenhum teste é declarado aprovado por causa de tentativa bloqueada.
