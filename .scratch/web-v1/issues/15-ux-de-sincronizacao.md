# 15 (T-15): UX de sincronização

**What to build:** indicador global (Sincronizado · Sem conexão · N pendentes · Erro), selo "pendente" por registro, "Sincronizar agora", aviso de nova versão sem perder a fila, logout seguro com aviso de pendências e limpeza dos dados locais, aviso de cota de armazenamento.

**Blocked by:** 14, 10

**Status:** aguardando-aprovacao

**Reqs:** RF-075, RF-077, RF-078, RNF-014, RNF-015 · **Seam:** e2e offline

- [ ] Fiel a `AppOffline` e `WebEstados`
- [ ] Dados do usuário A não aparecem ao usuário B no mesmo aparelho
- [ ] A atualização preserva a fila e não interrompe uma edição
