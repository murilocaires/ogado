# 12 (T-12): Endurecimento e jornadas e2e

**What to build:** revisão de segurança, logs estruturados sem PII, LGPD mínima, medição de desempenho da API e as 3 jornadas e2e (compra e venda → saldo; recria → resultado; offline).

**Blocked by:** 09, 10, 15, 16

**Status:** aguardando-aprovacao

**Reqs:** RNF-002 (API p95 < 300 ms), RNF-003, RNF-008, RNF-009, RNF-014 · **Seam:** e2e + API

- [ ] Checklist OWASP ASVS nível 1 revisado
- [ ] Logs com id de requisição e sem dados pessoais
- [ ] Jornada offline: lançar sem rede, reconectar, conferir sem duplicar
