# 04 (T-04): Fazenda, isolamento multi-tenant e login por e-mail/senha

**What to build:** cadastro e login com e-mail/senha (argon2id), sessão em cookie HttpOnly, logout, uma fazenda por conta e isolamento por `fazendaId` em toda consulta. Define a convenção de entidades sincronizáveis (ADR-0007): `id` UUID do cliente, `version`, `updatedAt`, `deletedAt`. Inclui a tela de login. Decidir a biblioteca de auth em ADR próprio.

**Blocked by:** 01

**Status:** aguardando-aprovacao

**Reqs:** RF-001 (e-mail/senha), RF-010, RNF-003, RNF-004 · **Seam:** rotas HTTP da API (Postgres real) + e2e de login

- [ ] Cadastro cria conta e sessão; login e logout funcionam
- [ ] Teste de integração: usuário A nunca lê nem altera dados da fazenda B
- [ ] Cookies HttpOnly/SameSite, CSRF, rate limit e headers de segurança
- [ ] Modelo base com UUID de cliente, `version`, `updatedAt`, `deletedAt` documentado e testado
- [ ] ADR da biblioteca de auth
