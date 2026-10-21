# ADR-0012 — Revisão da spec a partir do protótipo navegável (2026-10-18)

> **Nota (2026-10-19, ADR-0013):** a decisão A.2 (desconto percentual) e o parâmetro `descontoVendaPct` foram **revertidos** pelo dono: o desconto é de **10 kg por cabeça**. A base da @ por lote (A.1) e o restante deste ADR seguem valendo. Ver `0013-desconto-venda-kg-por-cabeca.md`.

**Status:** aprovado pelo humano em 2026-10-18 (inclui a mudança do princípio 2: a venda deixa de seguir a planilha; Q-A aceita; demais Q-B…Q-G seguem as propostas) · **Data:** 2026-10-18
**Fonte histórica:** protótipo navegável entregue pelo pecuarista (HTML original não está presente neste checkout; dados só no `localStorage`, sem backend)
**Requisitos afetados:** RN-002, RN-009, RN-017, RN-019, RN-023, RN-024…RN-027 (novos), RF-004…RF-007, RF-024…RF-026, RF-032…RF-036, RF-040, RF-052, RF-053, RNF-009 · **Relacionados:** ADR-0004, ADR-0008, ADR-0010, ADR-0011

## Contexto
O projeto mudou: o pecuarista montou um protótipo funcional (Painel, Negócios, Recria, Conta) que passa a ser a **referência de comportamento e de UX**. Ele diverge da spec em regras de cálculo (venda), na forma de escolher variantes, no escopo de cenários e em telas que não existiam (Conta, ajuda contextual, comparação). Este ADR registra cada divergência, o que muda na documentação e o que fica **em aberto**. O motor de cálculo do protótipo (`window.Bovaro`) é a fonte para as fórmulas novas; a planilha continua sendo a fonte das fórmulas que o protótipo não alterou.

Regra de leitura: **o protótipo vale onde ele fala**; onde ele é omisso (cadastro, primeiros passos, parâmetros editáveis, offline, sincronização) a spec anterior continua valendo e a omissão é listada em "Em aberto" para o humano decidir. Os `references/design/*.dc.html` seguem somente leitura; onde divergem do protótipo, vale o protótipo.

## O que muda (decisões propostas)

### A. Regras de cálculo — Compra e Venda
1. **Base do preço da @ na venda, por lote** (RN-024): `vivo` (padrão; @ = `arrobaVivoKg`, 30 kg) ou `carcaca` (@ = `arrobaCarcacaKg`, 15 kg). A compra é sempre peso vivo ÷ 30. *Antes:* a venda era sempre 15 kg.
2. **Desconto na venda é percentual do peso, por lote** (RN-025, substitui o desconto de 10 kg × cab da RN-002): `kg líquido = kg × (1 − desconto%)`, padrão 10%, opcional por lote (a compra não tem desconto). O desconto vem **ligado automaticamente** quando a categoria é feminina (texto contém bezerra, novilha, vaca, fêmea, matriz ou garrota) e **desligado** nas demais, até o usuário mexer no seletor; depois disso a escolha dele prevalece. A tela avisa: "em vendas de fêmeas é comum descontar 10% do peso".
3. **Consequência para a paridade (constituição, princípio 2):** com o padrão novo, o exemplo de ouro da venda **deixa de reproduzir a planilha** (a planilha desconta 10 kg × cab e usa @ de 15 kg). A fórmula da planilha fica documentada como **referência histórica** (`03-formulas-e-paridade.md` §A e §D3). Valores propostos para o novo ouro de venda (`origem: "nao-planilha"`, a revisar pelo humano) estão em `03-formulas-e-paridade.md` §A2.
4. O parâmetro `descontoVendaKgCab` (kg/cab, ADR-0011) passa a **`descontoVendaPct`** (fração, padrão `0.10`). Impacta o T-05 (coluna, contrato e domínio já iniciados) — ver `.scratch/web-v1/issues/05-*.md`.

### B. Variantes e simulação da recria
5. **Lotação inicial (RN-009/RN-023):** o protótipo coloca o seletor "Lotação inicial calculada sobre: 80 ha de referência | área pastável informada" **dentro da simulação** (cada cenário guarda o seu), com a dica "só altera a lotação inicial, não o resultado financeiro". Isto **substitui o ADR-0008 §2** ("não há seletor dentro da simulação") **para `lotacaoInicial`**. O padrão continua `fixa80`.
6. **Faturamento bruto (RN-017):** o protótipo só implementa `pesoVivo` (peso final ÷ 30 × cab × R$/@), sem seletor. A variante `carcaca` **não aparece**. Proposta: manter `faturamentoBruto = pesoVivo` fixo na v1 e **adiar** a variante `carcaca` (RN-023 fica só com `lotacaoInicial`). Em aberto: confirmar com o pecuarista.
7. **Alertas não bloqueantes passam a v1 (RN-026):** cabeças fracionárias ("compra X cabeças ≈ Y"), lotação de entrada > 4 UA/ha, lotação de saída > 6 UA/ha e mais de 250 cabeças. Antes eram da "Metas", v2.
8. **GMD implícito (RN-019)** passa de S para M: aparece em "Números do lote".

### C. Cenários da recria
9. Salvar com **nome livre** (padrão "Cenário N"; placeholder "Safra 26/27 — preço otimista") e **data**; **não há campo "ano safra"** (o ano safra, se quiserem, vai no nome). Ações: abrir no simulador (substitui as entradas atuais), duplicar ("… (cópia)"), renomear, excluir com confirmação. Lista **ou** grade, busca por nome, ordenação (mais recentes · maior líquido · nome A–Z), ★ no melhor líquido.
10. **Comparação de 2 a 3 cenários passa de S/v1.1 para M/v1** (RF-033): linhas de indicadores com a diferença em relação ao primeiro cenário marcado (verde = melhor, vermelho = pior), ★ no melhor líquido; marcar um 4º avisa "Compare até 3 cenários".
11. O cenário continua guardando **snapshot** das variantes e dos parâmetros (RN-023, ADR-0008 §3): o protótipo apenas recalcula a partir das entradas, mas a spec mantém o snapshot para que mudar a configuração não altere o passado.

### D. Telas e navegação
12. **Navegação com 4 itens:** Painel · Negócios · Recria · Conta (barra inferior em tela estreita). "Negócios" substitui a rota `/negocios` de "Compra e Venda" e reúne compras **e** vendas (abas Todas/Compras/Vendas) — os tickets T-06 (compras) e T-17 (vendas) continuam separados por entrega, mas a tela é uma só.
13. **Tela Conta** (RF-004…RF-007): perfil (nome, e-mail), senha (definir/alterar), Google (vincular/desvincular; não desvincula sem senha), fazenda (nome, área pastável), sair e "Apagar minha conta" (exige digitar "deletar"). Exclusão de conta sobe de RNF-009 (S) para requisito funcional M.
14. **Ajuda contextual** (RF-052): botão "i" em cada indicador calculado abre um balão com nome, explicação em linguagem simples e "Como é calculado". Fecha com Esc, clique fora ou rolagem; `aria-expanded`.
15. Modal de lote: alternância Compra/Venda só no lançamento novo; número do lote sequencial por tipo; categoria em texto livre com sugestões (gravada em maiúsculas); **cada modo de peso guarda o que foi digitado** (marca ● nos modos com valor guardado; só o modo ativo entra na conta); peso a peso aceita separador por linha, `;` ou `, `; pré-visualização calculada (menta + cadeado); confirmação antes de salvar e antes de excluir.
16. Painel: saldo (hero) com Comprado/Vendido, cartão "Recria · simulação atual" (líquido, por mês, por hectare), atalhos (nova compra, nova venda, simular recria) e **últimas 6 operações** por data decrescente; saudação com nome e resumo de cabeças.

## Em aberto (precisa de decisão do humano antes de implementar)
| # | Pergunta | Impacto | Proposta |
|---|---|---|---|
| Q-A | Aprovar que o **padrão da venda deixe de ser a planilha** (base vivo + desconto % só para fêmeas)? Ou manter um "modo planilha" (base carcaça, 10 kg × cab) como opção? | Princípio 2 da constituição; ouro de venda; T-02 (já implementado), T-17 | Aprovar o protótipo como regra e manter a fórmula da planilha só como referência histórica |
| Q-B | O desconto automático por categoria usa só o **texto** da categoria. Aceitar essa heurística ou ter um campo "sexo" no lote? | RN-025; T-06/T-17 | Aceitar a heurística na v1; campo "sexo" fica para quando houver cadastro de categorias |
| Q-C | **Variante `carcaca` do bruto** sai da v1? | RN-017/RN-023; T-03 (já implementado) | Adiar; manter o código do domínio sem expor na tela |
| Q-D | **Primeiros passos (RF-003)** e **configurações com parâmetros editáveis (RF-011, RN-021)**: o protótipo não tem. Mantêm-se? | T-05 (backend pronto, front pendente) | Manter os requisitos; a tela de configurações vira uma seção da Conta; primeiros passos continuam opcionais até confirmação |

> **Q-D encerrada em 2026-10-19 (decisão do dono):** não haverá tela de parâmetros editáveis (RF-011/RN-021); a área da fazenda não alimenta a "Área pastável". Primeiros passos (RF-003) seguem opcionais.
| Q-E | O simulador abre **em branco** no protótipo; o ADR-0011 prevê abrir com os padrões da fazenda (rendimento, imposto, consumo, proteinado, sanidade). Qual vale? | T-07 | Manter os padrões da fazenda preenchidos |
| Q-F | Regras de senha: o protótipo exige 8 caracteres; o T-04 (ADR-0010) é mais estrito. | RF-001 | Manter o ADR-0010 |
| Q-G | Cenário "por ano safra" (RF-032): aceitar nome livre + data sem campo de safra? | T-08 | Aceitar |

## Consequências
- Documentação passa a descrever o protótipo como alvo; nenhum código foi alterado por este ADR.
- **T-05** fica bloqueado nas partes que dependem de Q-A (parâmetro de desconto), Q-C e Q-D até a decisão.
- **T-02** (compra e venda no domínio) precisa de nova rodada: base da @ por lote e desconto percentual (RN-024/025); o ouro antigo de venda vira teste de "referência histórica".
- **T-08** ganha busca/ordenação/grade; **T-19** (novo) entrega a comparação; **T-18** (novo) entrega a Conta; o ticket de ajuda contextual (RF-052) entra no T-10.
- Os ADR-0004/0008/0011 ganham aviso de status apontando para este ADR; ficam válidos nas partes não citadas aqui.
