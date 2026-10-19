# ADR-0013 — Desconto de venda em kg por cabeça (não em %)

**Status:** aprovado pelo dono em 2026-10-19 (regra de negócio; sem pendências) · **Data:** 2026-10-19
**Requisitos afetados:** RN-002, RN-021, RN-024, RN-025, RF-021, RF-026 · **Relacionados:** ADR-0011, ADR-0012 (reverte a parte do desconto %; mantém a base da @)

## Contexto
O ADR-0012 (Q-A) adotou, a partir do protótipo, um desconto **percentual** do peso na venda (padrão 10%). O dono esclareceu que confundiu o percentual do protótipo: o desconto de venda das fêmeas é de **10 kg por cabeça**, como na planilha (`F11` = (kg − qtd × 10) ÷ 15).

## Decisão
1. **Desconto em kg por cabeça, por lote:** `kg líquido = kg − qtd × descontoKgCab`. Padrão **10 kg/cab.**; opcional por lote (desligar = 0 kg); só existe na venda. A compra continua sem desconto.
2. **Ligação automática** por categoria feminina (regex `categoriaFeminina`, inalterada) e edição por lote, como já definido (RN-025). O campo do lote passa a ser em kg por cabeça.
3. **Mantido do ADR-0012:** base da @ por lote (vivo 30 kg, padrão | carcaça 15 kg, RN-024) e todo o resto da revisão.
4. **kg líquido negativo** (`qtd × desconto > kg`): o domínio limita o kg líquido a **0**; logo @ = 0 e total = R$ 0, nunca negativos. `kgDescontado` informa o que de fato foi descontado (= kg nesse caso). Descontos informados negativos valem 0. Não se usa "indefinido" (RN-022) porque nesse caso o valor é bem definido e o R$/cab. (qtd > 0) fica 0; "indefinido" segue só para qtd = 0.
5. **Paridade:** com base `carcaca` e 10 kg/cab., a venda do domínio **bate com a planilha** (`F11`/`H11`/`H19`; ouro: 16 cab., 2.920 kg → 184 @, R$ 53.360,00, saldo −89.475,8333…). O ouro da venda volta a ser comparado com a planilha (`pnpm test:parity`, injetando `base: 'carcaca'` nas vendas do golden, que não traz base).

## Mudanças técnicas
- **Domínio:** `descontoVendaPct` → `descontoVendaKgCab` (Decimal, padrão 10) em `ParametrosCompraVenda` e na configuração da fazenda; `LoteInput.desconto` é kg/cab.; `LinhaCalculada` expõe `descontoKgCab` e `kgDescontado` (no lugar de `descontoPct`).
- **Contrato/API:** o campo do lote `desconto` (fração) é substituído por `descontoKg` (string decimal, 8 dígitos, 3 casas, aceita 0). O contrato é `strictObject`: o campo antigo é recusado (clientes antigos em cache precisam atualizar; o app é versionado por build).
- **Banco (migração aditiva `20261020120000_add_lote_desconto_kg`):** nova coluna `Lote.descontoKg Decimal(8,3)?`. A coluna `desconto` fica como **legado** (sem leitura/escrita); sua remoção é destrutiva e exige ADR própria. Backfill: lotes de venda com `aplicarDesconto = true` recebem `descontoKg = 10`, **qualquer que fosse a fração antiga** (10% ou outro valor), porque o percentual antigo não tem equivalente em kg/cab.; os demais ficam `NULL` (o cliente usa o padrão de 10 se o desconto for ligado).
- **Web:** `LoteEntity.descontoPct` → `descontoKg`; rótulo "Desconto (kg por cabeça)"; exportação CSV/XLSX com colunas "Desconto (kg/cab.)" e "kg líquido" (no lugar de "Desconto (%)"). O localStorage (chave `ogado.e2.v2`) passa ao esquema 3: ao ler lotes dos esquemas 1 e 2, venda com `descontoPct` e desconto ligado vira `descontoKg: '10'`, desligada vira `''`, e `descontoPct` some; o envelope é regravado no esquema 3.
- **Protótipo:** `docs/prototipo/ogado-prototipo.html` **não é editado** (referência histórica). **Divergência registrada:** o protótipo usa desconto em %; o produto usa kg por cabeça. Onde a spec e o protótipo divergem nesse ponto, vale este ADR.

## Consequências
- Valores de ouro da venda (lote 16 cab., 2.920 kg, R$ 290/@; compras 142.835,8333…): carcaça + 10 kg/cab. = 184 @ → R$ 53.360,00, saldo −89.475,8333…; vivo + 10 kg/cab. = 92 @ → R$ 26.680,00, saldo −116.155,8333…; vivo sem desconto = 97,3333… @ → R$ 28.226,6667…, saldo −114.609,1667….
- O ADR-0012 ganha nota apontando a este.
