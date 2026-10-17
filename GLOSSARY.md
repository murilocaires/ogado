# Glossário (linguagem ubíqua)

Use estes termos no código, testes, tickets e UI. Código em inglês técnico; termos de domínio ficam em português (`arroba`, `lote`, `recria`).

| Termo | Definição | Evite |
|---|---|---|
| **Fazenda** | Tenant. Todo dado de negócio pertence a uma fazenda. | conta, empresa |
| **Lote** | Grupo de animais comprado ou vendido junto, com categoria, quantidade, peso e preço da @. | rebanho (é o conjunto total) |
| **Categoria** | Bezerros, bezerras, garrotes, novilhas, bois, vacas… | tipo |
| **Cabeça (cab.)** | Um animal. | unidade |
| **Arroba (@)** | Compra: 30 kg de peso vivo. Venda: 15 kg de carcaça. | arroba "genérica" sem dizer qual |
| **Peso vivo (PV)** | Peso do animal na balança. | — |
| **Rendimento de carcaça** | % do PV que vira carcaça (padrão 52%). | — |
| **Desconto de venda** | 10 kg por cabeça deduzidos antes de converter em @. | quebra (ambíguo) |
| **Modo de peso** | `total`, `medio` ou `individual`: como o peso do lote foi informado. | — |
| **Saldo** | Total de vendas − total de compras. | lucro (não é lucro) |
| **UA (Unidade Animal)** | 450 kg de PV. | — |
| **Lotação** | UA por hectare. | taxa de lotação |
| **Área pastável** | Hectares de pasto utilizáveis na recria. | área total |
| **Recria** | Fase de criar bezerros a pasto até o peso de venda/engorda. | — |
| **Simulação / Cenário** | Conjunto de entradas da recria + resultado, salvo por ano safra. | projeto |
| **Ano safra** | Julho a junho. | ano civil |
| **GMD** | Ganho médio diário (kg/cab/dia). | — |
| **Proteinado** | Suplemento mineral-proteico fornecido no cocho. | ração |
| **Custo operacional** | Suplemento + sanidade + imposto + frete + funcionário (não inclui o investimento). | custo total |
| **Faturamento bruto / líquido** | Bruto = peso final ÷ 30 × cab × preço da @ (padrão da planilha; variante `carcaca` opcional, ADR-0008). Líquido = bruto − custo operacional − investimento. | lucro, margem |
| **Total em caixa** | Investimento + líquido. | — |
| **Campo calculado** | Valor derivado, somente leitura (menta + cadeado). | campo bloqueado |
| **Paridade** | Resultado idêntico ao da planilha para as mesmas entradas. | — |
| **Variante de fórmula** | Alternativa escolhida nas configurações da fazenda para um cálculo que diverge do texto do curso; o padrão é sempre o da planilha (ADR-0008). | modo, opção avulsa |
| **PWA / app instalável** | A versão web instalada no aparelho, abre em janela própria e funciona sem internet. | aplicativo (reservar para o app nativo da v3) |
| **Fila de envio (outbox)** | Lançamentos feitos offline, guardados no aparelho até subirem ao servidor. | rascunho |
| **Pendente** | Registro salvo no aparelho e ainda não enviado. | não salvo |
| **Sincronização** | Envio da fila e recebimento das mudanças do servidor. | upload |
| **Conflito** | Mesmo registro alterado em dois aparelhos; o usuário decide qual manter. | erro |
| **PA-xx** | Ponto de atenção encontrado nas planilhas (`docs/negocio/01-negocio.md` §8). | — |
