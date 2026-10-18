# 08 (T-08): Cenários por ano safra

**What to build:** salvar uma simulação como cenário de um ano safra (julho a junho), duplicar e renomear. O cenário guarda a variante e os parâmetros usados.

**Blocked by:** 07

**Status:** aguardando-aprovacao

**Reqs:** RF-032, RN-023 · **Seam:** API + e2e

- [ ] Lista de cenários com data, por ano safra
- [ ] Mudar a configuração da fazenda não altera cenário salvo
- [ ] Resultado guardado como string decimal sem arredondar (ADR-0003)

**Revisão pós-protótipo (ADR-0012, proposta):** cenário = nome livre (padrão "Cenário N") + data, sem campo de ano safra (Q-G); duplicar "(cópia)", renomear, excluir com confirmação (RF-032). Busca, ordenação, grade, comparação e ★ ficam no T-19.
