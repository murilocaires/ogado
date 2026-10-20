# Correções de segurança — 20/10/2026

Ticket: `.scratch/correcoes-auditoria-2026-10-20/issues/01-seguranca.md`; critérios 1 e 4 da spec vinculada. Orientação: agentes `backend-engineer` e `test-engineer`, skills `tdd` e `prisma-migrations`, constituição e glossário. As fronteiras HTTP/Fastify com PostgreSQL real já estavam autorizadas na spec; nenhuma regra de cálculo foi alterada.

## Alterações

- **P1 SEC-03/04 — RF-002/004/005:** emissão, resgate e troca de credenciais usam o mesmo bloqueio da linha do usuário, dentro de transações PostgreSQL. Troca de senha revoga links pendentes e outras sessões atomicamente. Troca de e-mail revoga links enviados ao endereço anterior; editar somente o nome conserva o link. Emissão concorrente deixa somente um link utilizável, e resgate invalida os demais links pendentes. O emissor verifica novamente o e-mail sob bloqueio para impedir emissão válida para endereço lido antes de uma troca concorrente.
- **Sessão de login e rehash:** a emissão da sessão compara novamente o hash e o e-mail verificados, sob o mesmo bloqueio de usuário, e aplica eventual rehash dentro dessa transação. Uma verificação da senha antiga iniciada antes de um reset/troca não pode criar sessão após a revogação. A migração técnica dos parâmetros Argon2 não revoga links/sessões nem sobrescreve uma senha trocada após a leitura. Trocas autenticadas também comparam o hash verificado, evitando que duas verificações da senha antiga autorizem duas trocas concorrentes.
- **P1 SEC-02 — RNF-003:** rotas são registradas em plugin executado após os plugins de proteção. O teto global automático agora intercepta rotas comuns; teto 2 produz 200/200/429, com envelope e `Retry-After`, sem afetar outro IP.
- **P2 SEC-01 — RNF-008:** os dois caminhos assíncronos de e-mail registram categorias e operações fixas. Mensagem, nome e código arbitrários do erro do provedor não são incluídos no log.
- **P2 — RNF-014:** autenticação e rotas privadas recebem `Cache-Control: no-store`, inclusive respostas 401. `/health` público conserva sua política anterior.
- **RF-078/RNF-014 — vínculo da requisição:** rotas privadas com `x-ogado-usuario` comparam a identidade capturada pelo cliente com a sessão antes de renovar sua inatividade ou executar o handler. Divergência retorna 401, sem escrita de negócio, exportação, e-mail ou `Set-Cookie`. Logout com o cabeçalho exige esse mesmo vínculo; sem cabeçalho continua compatível com clientes antigos, inclusive logout anônimo 204. O cabeçalho não escolhe o tenant nem substitui a autenticação pelo cookie.
- **P1 operacional — RNF-003/008:** harness e scripts de limpeza/preparação exigem `TEST_DATABASE_URL` explícita, sem fallback para desenvolvimento. O guardião puro compartilhado rejeita banco sem identificação `test`/`teste`, hosts fora de loopback/serviço CI permitido, protocolos incorretos, parâmetros que possam sobrescrever o destino e `DATABASE_URL` divergente. Erros não ecoam credenciais. A migração usa diretamente o CLI Prisma instalado, sem bootstrap do gerenciador de pacotes; há timeout de 60 s. A suíte API tem um worker e execução sequencial de arquivos.

## Evidência red → green

| Regressão | Antes | Após correção | Evidências |
|---|---|---|---|
| Link emitido antes da troca autenticada de senha | Resgate retornava 204 indevido | Retorna 400; nova senha entra e sessão atual permanece | `security-lifecycle-red.log`, `security-lifecycle-green.log` |
| Login em andamento durante reset/troca de senha | 2 casos permitiam login 200 após a revogação | Login 401 sem cookie; nova senha entra; 9 casos de credenciais aprovados | `security-login-race-red.log`, `security-login-race-green.log` |
| Guardião de destino de testes | 8 casos aceitavam destino ausente/inseguro | 14 casos aprovados, incluindo destinos válidos e erro sem credenciais | `security-db-guard-red.log`, `security-db-guard-green.log` |
| Teto global | Terceiro `/health` ainda retornava corpo de sucesso | 4 testes de rate limit aprovados | `security-rate-red.log`, `security-rate-green.log` |
| Erros de e-mail | 2 casos reproduziam marcador sintético nos logs | Ambos aprovados, categoria fixa | `security-email-logs-red.log`, `security-email-logs-green.log` |
| Política de cache | Cabeçalho ausente em cadastro | Teste aprovado para cadastro, sessão, lotes, exportação, erros 401 e health | `security-cache-red.log`, `security-cache-green.log` |
| Requisição de A usando cookie atual de B | 5 falhas: criação, alteração, leitura/exportação, logout e renovação indevidos | 15/15 aprovados: 5 casos novos e 10 regressões existentes de logout/inatividade | `security-context-red.log`, `security-context-green.log` |

Arquivos de evidência estão em `evidencias/`, neste diretório. Os marcadores de erro dos testes são exclusivamente sintéticos.

A execução focada (`security-focused.json`/`.log`) aprovou 45 de 46 testes; o único erro era uma URL incorreta no novo teste de cache (`/dados/lotes`, inexistente), corrigida para `/lotes` e validada em `security-cache-green.log`. A revisão encontrou depois a corrida entre verificação e criação de sessão: duas regressões adicionais reproduziram o erro e ficaram verdes junto aos sete casos anteriores. O teste HTTP controla o retorno de `verify` com um adaptador injetável que executa Argon2 real e aguarda um sinal; o banco não é substituído e todas as assertivas são feitas por HTTP. Isso cobre **48 testes únicos aprovados** nessas quatro suítes: 9 de ciclo de credenciais, 4 de limites, 21 de segurança HTTP e 14 do guardião. Typecheck da API passou (`security-typecheck.log`), assim como ESLint nos arquivos desta frente (`security-lint.log`, saída vazia, código 0).

O gate integrado subsequente aprovou **225/225 testes da API em 25 arquivos**, sem falhas ou testes pulados, em 106,36 s de Vitest, com as nove migrações aplicadas. Os 48 casos descritos acima e os três testes incrementais da frente de persistência já estão contidos nesses 225: não somar as execuções focadas ao total. Evidências: [log completo](evidencias/api-completa.log), [JSON do Vitest](evidencias/api-completa.json), [tempo/código de saída](evidencias/api-completa-execucao.json) e [infraestrutura](evidencias/security-infraestrutura.log).

Após a retomada, a revisão identificou também requisições antigas com cookie compartilhado de outra conta. Os cinco novos casos de contexto foram reproduzidos por HTTP com PostgreSQL real e ficaram verdes, junto aos dez casos anteriores de sessão/logout (15/15, 51,83 s). Um relógio injetável prova por expiração observável via HTTP que a tentativa divergente não prolonga a sessão B. A primeira tentativa dentro do sandbox atingiu timeout no subprocesso Prisma antes de executar testes; a execução local autorizada fora do sandbox produziu o RED/GREEN comportamental registrado. Essa ampliação aguarda o gate final consolidado da coordenação; o total de 225 acima descreve a etapa anterior.

Typecheck e ESLint dos arquivos de contexto também passaram, código 0 ([typecheck](evidencias/security-context-typecheck.log), [lint](evidencias/security-context-lint.log)). A compatibilidade do cabeçalho opcional e sua limitação para abas com cliente legado estão documentadas no ADR-0016.

## Ambiente e limites

PostgreSQL real 17.11, container exclusivo `ogado-correcoes-20261020-security`, porta `127.0.0.1:55440`, banco `ogado_correcoes_test_20261020`; tmpfs de 256 MiB, memória máxima 512 MiB e um CPU. O container de desenvolvimento `ogado-dev-kit-postgres-1` foi preservado. Não houve migração destrutiva, acesso a produção, entrega real de e-mail ou autenticação Google externa. A migração adicional de índices pertence à frente de persistência e foi aplicada no mesmo banco descartável antes do gate integrado.

O PostgreSQL temporário permanece disponível até a coordenação concluir a validação integrada. Bloqueios por usuário se limitam às operações de credenciais; os testes não constituem medição de carga ou validação de rate limit distribuído entre múltiplas instâncias.
