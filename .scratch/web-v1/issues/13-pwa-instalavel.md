# 13 (T-13): PWA instalável com shell offline

**What to build:** manifest, ícones 192/512/maskable, service worker (shell e estáticos), botão "Instalar o app" e instruções para iOS; abrir e calcular sem internet depois da primeira visita (ADR-0007).

**Blocked by:** 07

**Status:** aguardando-aprovacao

**Reqs:** RF-070, RF-071, RF-072, RNF-012, RNF-016 · **Seam:** e2e offline + Lighthouse

- [ ] Lighthouse: instalável
- [ ] Com `setOffline`, o app abre e o simulador dá o resultado de ouro
- [ ] O service worker nunca guarda respostas autenticadas da API
- [ ] Matriz de verificação: Chrome/Edge desktop e Android, Safari iOS ≥ 16.4
