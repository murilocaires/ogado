# 06 (T-06): Compras ponta a ponta

**What to build:** CRUD de lotes de compra com os 3 modos de peso, incluindo a lista de pesos animal a animal, do schema à tela. As telas acessam dados por uma interface de repositório (sobre a API agora; local-first no T-14).

**Blocked by:** 02, 04

**Status:** aguardando-aprovacao

**Reqs:** RF-020, RF-022, RN-003, RN-004 · **Seam:** API + e2e

- [ ] Cria, edita e exclui (com confirmação) lote de compra
- [ ] Modo individual: colar lista, editar e remover pesos; qtd = nº de pesos
- [ ] Campos calculados em menta com cadeado, não editáveis (RF-051)
- [ ] Toda consulta com `fazendaId`; tela fiel a `WebCompraVenda`

**Herdado do T-05 / ADR-0011:** primeira rota DELETE aplica §7 (sem corpo, `?version=N`, CSRF sem exigir `Content-Type` só para DELETE sem corpo); PATCH com versão otimista e 409 `atual` no mesmo padrão da Fazenda; colisão de UUID de cliente com outra fazenda (CA-15 do T-04) testada na criação de lote; parâmetros de compra vêm da configuração da fazenda; se o lote guarda snapshot dos parâmetros depende da Q3 do T-05.

**Revisão pós-protótipo (ADR-0012, proposta):** a tela é a unificada **Negócios** (RF-024, RF-025): abas, número do lote sequencial, categoria livre em maiúsculas, retenção de valores por modo de peso (RN-027), confirmação ao salvar/excluir, pré-visualização menta + cadeado, ajuda "i" (RF-052).
