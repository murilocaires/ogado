# 14 (T-14): Dados locais e sincronização

**What to build:** banco local (IndexedDB), fila de envio, `/sync/push` e `/sync/pull`, idempotência, conflitos com decisão do usuário, itens rejeitados em "precisa de atenção" e sessão expirada offline. As telas passam a usar o repositório local-first.

**Blocked by:** 06, 08, 13, 17

**Status:** aguardando-aprovacao

**Reqs:** RF-073, RF-074, RF-076, RF-079, RF-080, RNF-013, RNF-017 · **Seam:** API `/sync/*` + e2e offline

- [ ] Lançamentos offline sobem ao reconectar, sem duplicar nem perder, mesmo com a rede cortada no meio do envio
- [ ] Versão base desatualizada gera conflito; exclusão x edição pergunta; nunca "último vence"
- [ ] Decimais guardados como string no IndexedDB
- [ ] Sessão expirada offline mantém a fila; o login retoma o envio
- [ ] Abertura a frio < 2 s; leitura local < 100 ms
