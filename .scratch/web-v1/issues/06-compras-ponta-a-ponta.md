# 06 (T-06): Compras ponta a ponta

**What to build:** CRUD de lotes de compra com os 3 modos de peso, incluindo a lista de pesos animal a animal, do schema à tela. As telas acessam dados por uma interface de repositório (sobre a API agora; local-first no T-14).

**Blocked by:** 02, 04

**Status:** aguardando-aprovacao

**Reqs:** RF-020, RF-022, RN-003, RN-004 · **Seam:** API + e2e

- [ ] Cria, edita e exclui (com confirmação) lote de compra
- [ ] Modo individual: colar lista, editar e remover pesos; qtd = nº de pesos
- [ ] Campos calculados em menta com cadeado, não editáveis (RF-051)
- [ ] Toda consulta com `fazendaId`; tela fiel a `WebCompraVenda`
