# 16 (T-16): Entrada com Google e recuperação de senha

**What to build:** login com Google (OAuth) e recuperação de senha por link que expira, com envio de e-mail. Escolher o provedor de e-mail em ADR.

**Blocked by:** 04

**Status:** aguardando-aprovacao

**Reqs:** RF-001 (Google), RF-002 · **Seam:** API + e2e

- [ ] Entrar com Google cria ou reconhece a conta
- [ ] O link de reset expira e só vale uma vez
- [ ] Rate limit nos endpoints de reset
