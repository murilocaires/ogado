# SEC-02/03/04 — ciclo de credenciais e limite global
Type: task
Status: resolved
Blocked by: —

RF-002/004/005; RNF-003/008. Implementar critérios 1 e logging do critério 4 da spec. Testes HTTP com Postgres real. Guardião de banco de teste e scripts de preparação pertencem a este ticket.

## Answer

Ciclo de credenciais e emissão de sessão sob lock transacional; revogação de links, rehash seguro, rate limit global ativo, logs fixos, no-store e guardião explícito de banco. Regressões RED/GREEN e API completa final 227/227 aprovados. Ver `docs/auditoria/2026-10-20-correcoes/seguranca.md` e evidências `api-final.txt`.
