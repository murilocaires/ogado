# 04 (T-04): Fazenda, isolamento multi-tenant e login por e-mail/senha

**What to build:** cadastro e login com e-mail/senha (argon2id), sessão própria em Postgres com cookie opaco HttpOnly, logout, uma fazenda por conta (criada no cadastro) e isolamento por `fazendaId` em toda consulta. Define e testa na Fazenda a convenção de entidades sincronizáveis (ADR-0007): `id` UUID, `version`, `updatedAt` do servidor, `deletedAt`. Inclui a tela de login/cadastro e os estados de sessão do front. Decisões em **ADR-0010** (proposto).

**Blocked by:** 01 (concluído)

**Status:** ready-for-agent (ADR-0010 aprovado em 2026-10-17; Q1: mín. 8 caracteres com maiúscula, número e símbolo; Q2: 30 dias/90 dias; Q3 sem verificação de e-mail; Q4 mensagem "Já tem conta? Entrar"; Q6 sem bloqueio, só rate limit; Q7 sem "sair de todos")

**Reqs:** RF-001 (e-mail/senha), RF-002 (sessão e logout), RF-010, RNF-003, RNF-004, RF-080 (só o contrato de 401; a fila vem no T-14) · **Seam:** rotas HTTP da API (Postgres real) + e2e de login

## Critérios de aceite

**Cadastro e login (RF-001)**
- [x] **CA-01** Dado um e-mail não cadastrado e uma senha válida, quando cadastro, então recebo 201, um cookie de sessão HttpOnly/SameSite=Lax (Secure fora do dev), e o usuário e a fazenda passam a existir numa única transação.
- [x] **CA-02** Dado um e-mail com maiúsculas ou espaços nas pontas, quando cadastro e depois entro com a forma normalizada, então entro na mesma conta.
- [x] **CA-03** Dado um e-mail já cadastrado, quando tento cadastrar de novo, então nenhuma conta é criada e a resposta segue a decisão Q4.
- [x] **CA-04** Dado uma conta existente, quando entro com a senha correta, então recebo 200 e uma sessão **nova**; um cookie de sessão anterior enviado junto não é reaproveitado (sem fixação).
- [x] **CA-05** Dado um e-mail inexistente ou uma senha errada, quando tento entrar, então os dois casos dão o mesmo status (401), o mesmo código `credenciais_invalidas` e o mesmo corpo.
- [x] **CA-06** Dado uma senha com menos de 8 caracteres, sem letra maiúscula, sem número ou sem símbolo, ou acima de 128 caracteres, quando cadastro, então recebo 400 com o caminho do campo e a regra que falhou (sem ecoar o valor); a tela mostra os requisitos antes do envio, em pt-BR.

**Sessão e logout (RF-002)**
- [x] **CA-07** Dado uma sessão válida, quando chamo a consulta de sessão, então recebo o usuário e a fazenda, sem hash nem token.
- [x] **CA-08** Dado uma sessão válida, quando saio, então a sessão deixa de existir no servidor e o mesmo cookie reenviado depois recebe 401; sair de novo também dá sucesso.
- [x] **CA-09** Dado uma sessão sem uso há mais tempo que o limite de inatividade, ou além do teto absoluto (Q2, configurável), quando faço uma requisição, então recebo 401 `sessao_expirada`.
- [x] **CA-10** Dado o banco de sessões, quando o inspeciono, então nenhuma linha contém o token em claro, só o hash do segredo, e a senha aparece só como hash argon2id com parâmetros ≥ OWASP (19 MiB, t=2, p=1).

**Isolamento (RF-010, RNF-004)**
- [x] **CA-11** Dado as fazendas A e B com dados, quando o usuário A tenta ler, listar, alterar ou excluir qualquer recurso de B, então recebe 404 (ou lista vazia) e os dados de B ficam intactos.
- [x] **CA-12** Dado qualquer rota autenticada registrada na API, quando a suíte roda, então o teste-guardião falha se essa rota não estiver coberta pelo teste de isolamento.
- [x] **CA-13** Dado uma rota de negócio, quando chamo sem cookie de sessão, então recebo 401 `nao_autenticado`.

**Convenção sincronizável (ADR-0007)**
- [x] **CA-14** Dado a fazenda recém-criada, quando a leio, então ela tem `id` UUID, `version` = 1, `updatedAt` do servidor e `deletedAt` nulo; após uma alteração aceita, `version` = 2 e `updatedAt` avança, mesmo que o cliente mande outro `updatedAt`. (O T-04 não tem rota para editar a fazenda; a segunda metade deste critério é testada pelo repositório da Fazenda e repetida na rota de configurações do T-05.)
- [x] **CA-15** Dado um UUID que já pertence à fazenda B, quando A tenta criar ou alterar um registro com esse id, então recebe erro genérico e o registro de B não muda nem aparece.

**Defesas (RNF-003)**
- [x] **CA-16** Dado mais tentativas de login que o limite por IP + e-mail, quando tento de novo, então recebo 429 `muitas_tentativas` com `Retry-After`; o mesmo vale para o cadastro por IP.
- [x] **CA-17** Dado uma requisição que altera estado com `Origin` fora da lista, `Sec-Fetch-Site: cross-site` ou corpo que não é JSON, quando chega à API, então recebo 403 e nada muda.
- [x] **CA-18** Dado um erro inesperado (ex.: banco indisponível no login), quando ocorre, então recebo 500 `erro_interno` com `requestId`, sem stack nem mensagem do ORM, e o log não contém senha, cookie nem e-mail.
- [x] **CA-19** Dado qualquer resposta da API, quando inspeciono os headers, então há CSP `default-src 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` e (em produção) HSTS; o CORS só aceita as origens configuradas, com credenciais.

**Front (tela de login e estados)**
- [x] **CA-20** Dado a tela de entrar, quando envio credenciais válidas, então chego ao painel (ou ao onboarding do T-05); com credenciais inválidas, vejo a mensagem genérica e o foco vai para o erro (teclado e leitor de tela).
- [x] **CA-21** Dado uma sessão que expira, quando a API responde 401, então o app mostra "Entre de novo" e **não** apaga dados locais; o logout explícito é a única ação que limpa o aparelho (contrato usado pelo T-14/RF-080).
- [x] **CA-22** (e2e) Dado um navegador limpo, quando cadastro, saio e entro de novo, então a jornada completa funciona e nenhum token aparece em localStorage ou IndexedDB.

- [x] ADR-0010 aprovado pelo humano, com Q1–Q4, Q6 e Q7 respondidas.

## Sequência TDD sugerida (primeiros 5 vermelhos, seam HTTP com Postgres real)
1. **RF-001 / CA-01**: o cadastro com e-mail novo responde 201, devolve o cookie de sessão HttpOnly e a consulta de sessão com esse cookie traz usuário e fazenda. Força a criação de usuário, fazenda, sessão, hash e cookie.
2. **RF-001 / CA-05**: o login com senha errada e o login com e-mail inexistente dão respostas idênticas, 401 `credenciais_invalidas`; com a senha certa, 200 e sessão nova. Força a verificação argon2id, o hash fictício e o envelope de erro.
3. **RF-002 / CA-08**: depois de sair, o mesmo cookie recebe 401. Força a revogação no servidor.
4. **RF-010 / CA-11 + CA-13**: com as fazendas A e B, o usuário A não enxerga a fazenda B e uma rota de negócio sem sessão dá 401. Força o contexto de tenant e o repositório escopado.
5. **RNF-003 / CA-16**: a 6ª tentativa de login em 1 minuto, para o mesmo IP e e-mail, responde 429. Força o rate limit por chave composta.

Em seguida: CA-12 (guardião de rotas), CA-14/15 (convenção), CA-17/18/19 (CSRF, erros, headers) e por fim a UI e o e2e (CA-20…22).

## Etapa 2 (front) entregue
Provas: `apps/web/components/AuthScreen.test.tsx` e `PainelPlaceholder.test.tsx` (CA-06 tela, CA-20, CA-21, diálogo de saída), `apps/web/lib/auth/*.test.ts` (cliente HTTP e máquina de estados), `apps/web/e2e/auth.spec.ts` (CA-20, CA-21, CA-22 contra API real + Postgres, Edge via `E2E_CHANNEL`). Capturas 1440/390 em `.scratch/web-v1/evidence/`. Rodar e2e: `docker compose up -d postgres` e `pnpm --filter @bovaro/web test:e2e`.
Desvios do design: sem "Esqueci a senha", "Continuar com Google" e "digital/rosto" (T-16/v3); cadastro só com e-mail e senha (o nome fica no onboarding T-05); mínimo de senha vem do ADR (8 + composição), não os 6 do mock; rotas `/entrar` e `/cadastrar`.

**Dívida do T-14 (troca de usuário, RF-078):** o controlador já detecta login de `usuarioId` diferente da identidade guardada (`getAccountMismatch()` e `onAccountMismatch`), sem apagar nem sobrescrever nada. Falta, no T-14: contar os lançamentos pendentes, mostrar "N lançamentos de outra conta ainda não foram enviados" e só apagar o banco local com confirmação; e decidir a identidade guardada depois da confirmação.

## Dívida técnica registrada (revisão de segurança da etapa 1)
- **Limpeza de sessões expiradas**: nada apaga as linhas de Sessão vencidas. Criar job/rotina de limpeza e um índice em `expiraEm` (migração aditiva).
- **Limite de concorrência do argon2**: hash e verificação rodam no pool de threads sem teto; uma rajada de logins/cadastros pode saturar CPU/memória. Limitar a concorrência (fila/semáforo) no hasher.
- **Sem limite por conta (Q6)**: o rate limit é por IP e por IP + e-mail; não há bloqueio nem atraso progressivo por conta, decisão consciente do Q6. Reavaliar no T-12 (endurecimento).
