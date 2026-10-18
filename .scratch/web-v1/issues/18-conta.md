# 18 (T-18): Conta

**What to build:** tela Conta do protótipo: perfil (nome, e-mail), senha (definir/alterar), Google (vincular/desvincular), fazenda (nome, área pastável), sair e apagar conta.

**Blocked by:** 04, 05

**Status:** aguardando-aprovacao (ADR-0012)

**Reqs:** RF-004, RF-005, RF-006, RF-007, RF-011 · **Seam:** API + e2e

- [ ] Perfil: nome obrigatório, e-mail válido, confirmação ao salvar
- [ ] Senha: atual correta, confirmação igual; regras do ADR-0010 (Q-F)
- [ ] Google: não desvincula sem senha definida (depende do T-16 para o fluxo real)
- [ ] Fazenda: nome e área; a área preenche a "Área pastável" do simulador
- [ ] Apagar conta só habilita após digitar "deletar"; remove perfil, fazenda, lotes e cenários
