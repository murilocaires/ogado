# 07 (T-07): Simulador de recria e resultado

**What to build:** a tela do simulador, que recalcula ao digitar com `packages/domain` no cliente e mostra o resultado completo e a variante ativa.

**Blocked by:** 03, 05

**Status:** aguardando-aprovacao

**Reqs:** RF-030, RF-031, RF-051, RNF-002 (recálculo < 50 ms) · **Seam:** e2e + domínio

- [ ] As entradas do exemplo de ouro produzem o resultado de ouro na tela
- [ ] Composição de custos, bruto, líquido, caixa, por mês e por ha com rótulos corretos (PA-02)
- [ ] "—" e dica quando falta dado; aviso de cabeças fracionárias
- [ ] Rótulo da variante em uso; fiel a `WebRecria`

**Herdado do T-05 / ADR-0011:** o simulador abre com as entradas iniciais da fazenda (área pastável, rendimento, imposto, consumo, proteinado, sanidade) e usa as variantes e parâmetros da configuração, passados por argumento ao domínio.

**Revisão pós-protótipo (ADR-0012, proposta):** seletor "Lotação inicial calculada sobre" dentro da simulação (RN-009); sem seletor de bruto (Q-C); alertas RN-026; resultado completo RF-031 (barra de custos com %, "Da venda ao líquido", "Números do lote" com GMD); entradas em % convertidas para fração; abrir em branco ou com padrões da fazenda: Q-E.
