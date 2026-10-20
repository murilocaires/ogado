# ARQ-02/03 — contratos e replay de cenários
Type: task
Status: resolved
Blocked by: —

RF-030/032/035/079; RN-023; RNF-001/017. Implementar critério 3, precisão Decimal isolada e seleção linear de RF-036; preservar alterações locais de cabeças inteiras. Coordenar contrato com persistência/sync.

## Answer

Contrato completo compartilhado e versionado, normalização de legado, replay de parâmetros/variantes, precisão isolada e destaques O(N). Domínio 132/132, contratos 49/49, paridade 181/181; benchmark 5.000 cenários p95 15,88 ms. Casos web e API aprovados. Ver `docs/auditoria/2026-10-20-correcoes/cenarios.md` e ADR-0015.
