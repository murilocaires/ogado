# Revisão independente de segurança — 20/10/2026

Escopo: mudanças locais da API, ciclo de credenciais, plugins, guardião de banco, testes e cabeçalhos Next. Referências: `.scratch/correcoes-auditoria-2026-10-20/spec.md`, constituição, ADR-0010 e auditoria original. Revisão por leitura; não foram executados testes pesados nem alterado código nesta etapa.

## Standards

Nenhuma nova violação adicional identificada. Emissão, consumo e troca de credenciais adquirem primeiro o mesmo bloqueio de usuário; o primeiro lookup do token não bloqueia sua linha. Isso mantém a ordem usuário → token e evita a inversão entre as operações revisadas. A revogação e a troca de hash ficam na mesma transação. Logs assíncronos de e-mail usam categorias fixas. O guardião roda antes das migrações/limpezas, rejeita destinos ambíguos e não inclui credenciais nos erros.

Os testes novos verificam efeitos públicos e valores independentes: respostas HTTP, uso posterior de links/sessões e casos literais de URL. O uso de `Promise.all` exercita concorrência, mas não controla o interleaving específico do achado abaixo.

## Spec

**P1 — sessão criada após revogação de senha.** Em `apps/api/src/routes/auth.ts:102`, o login verifica o hash lido; em `:125`, cria a sessão separadamente. `apps/api/src/session/session-service.ts:62` insere a sessão sem conferir novamente a credencial sob o bloqueio do usuário. Interleaving possível: login valida a senha antiga → reset ou troca autenticada commita e revoga sessões → login retoma e cria uma sessão válida com a senha revogada. O CAS de rehash cobre apenas parte do fluxo. Isso deixa incompleto o critério 1 da spec: “recuperar senha e mudar credenciais são operações transacionais”.

Correção solicitada ao responsável: criação da sessão e eventual rehash sob o mesmo bloqueio, condicionados ao hash efetivamente verificado. Teste HTTP determinístico deve pausar após a verificação real, concluir o reset, liberar o login e exigir 401 sem cookie válido. Achado aceito pela coordenação; correção em andamento.

A CSP permite os scripts/estilos da shell estática, o worker e o manifesto de mesma origem; `eval` e WebSocket só em desenvolvimento. Não foi identificada incompatibilidade estática com a PWA. A confirmação em navegador continua pertencendo ao gate integrado.

Resultado desta leitura: Standards sem achado adicional; Spec com um bloqueador P1, encaminhado para correção e nova validação.

## Resolução posterior

O P1 foi corrigido em `createPasswordSession`: lock de usuário, comparação do hash/e-mail verificados, rehash e emissão da sessão na mesma transação. Duas regressões HTTP determinísticas com Argon2 e PostgreSQL reais reproduziram o login indevido antes da correção; os nove casos de ciclo de credenciais passaram depois. Evidências: `evidencias/security-login-race-red.log` e `security-login-race-green.log`. A suíte integrada inicial aprovou 225/225 testes. O relatório consolidado registra a validação final após as demais correções.
