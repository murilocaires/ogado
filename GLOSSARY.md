# Glossário (linguagem ubíqua)

Use estes termos no código, testes, tickets e UI. Código em inglês técnico; termos de domínio ficam em português (`arroba`, `lote`, `recria`).

| Termo | Definição | Evite |
|---|---|---|
| **Fazenda** | Tenant. Todo dado de negócio pertence a uma fazenda. | conta, empresa |
| **Lote** | Grupo de animais comprado ou vendido junto, com categoria, quantidade, peso e preço da @. | rebanho (é o conjunto total) |
| **Categoria** | Bezerros, bezerras, garrotes, novilhas, bois, vacas… | tipo |
| **Cabeça (cab.)** | Um animal. | unidade |
| **Arroba (@)** | Compra: 30 kg de peso vivo. Venda: o lote escolhe a base, peso vivo (30 kg, padrão) ou carcaça (15 kg) (ADR-0012). | arroba "genérica" sem dizer qual |
| **Peso vivo (PV)** | Peso do animal na balança. | — |
| **Rendimento de carcaça** | % do PV que vira carcaça (padrão 52%). | — |
| **Desconto de venda** | Quilos por cabeça (padrão 10 kg/cab.) deduzidos do peso do lote antes de converter em @; automático para categorias femininas, editável por lote (ADR-0013; não é percentual). | quebra (ambíguo) |
| **Base da @ (venda)** | `vivo` ou `carcaca`: define quantos kg valem 1 @ no lote de venda (RN-024). | tipo de arroba |
| **Negócios** | Tela única de compras e vendas (abas Todas/Compras/Vendas). | Compra e Venda (nome da planilha) |
| **Conta** | Tela de perfil, senha, Google, fazenda e apagar conta. Não confundir com Fazenda (tenant). | Configurações |
| **Ajuda contextual** | Botão "i" que explica um indicador e mostra "Como é calculado" (RF-052). | tooltip |
| **Modo de peso** | `total`, `medio` ou `individual`: como o peso do lote foi informado. | — |
| **Saldo** | Total de vendas − total de compras. | lucro (não é lucro) |
| **UA (Unidade Animal)** | 450 kg de PV. | — |
| **Lotação** | UA por hectare. | taxa de lotação |
| **Área pastável** | Hectares de pasto utilizáveis na recria. | área total |
| **Recria** | Fase de criar bezerros a pasto até o peso de venda/engorda. | — |
| **Simulação / Cenário** | Conjunto de entradas da recria + resultado, salvo com nome livre e data; até 3 podem ser comparados. | projeto |
| **Ano safra** | Julho a junho. | ano civil |
| **GMD** | Ganho médio diário (kg/cab/dia). | — |
| **Proteinado** | Suplemento mineral-proteico fornecido no cocho. | ração |
| **Custo operacional** | Suplemento + sanidade + imposto + frete + funcionário (não inclui o investimento). | custo total |
| **Faturamento bruto / líquido** | Bruto = peso final ÷ 30 × cab × preço da @ (padrão da planilha; variante `carcaca` opcional, ADR-0008). Líquido = bruto − custo operacional − investimento. | lucro, margem |
| **Total em caixa** | Investimento + líquido. | — |
| **Campo calculado** | Valor derivado, somente leitura (menta + cadeado). | campo bloqueado |
| **Paridade** | Resultado idêntico ao da planilha para as mesmas entradas. | — |
| **Variante de fórmula** | Alternativa escolhida nas configurações da fazenda para um cálculo que diverge do texto do curso; o padrão é sempre o da planilha (ADR-0008). | modo, opção avulsa |
| **Parâmetro de cálculo** | Número que a planilha deixava dentro das fórmulas (30, 15, 10, 450, 52%, 1,5%, 0,3%, R$ 2/kg, R$ 2,50), editável nas configurações da fazenda (RN-021, ADR-0011). | constante, configuração avulsa |
| **Padrão da planilha** | Valores e variantes iguais aos das planilhas do curso; "restaurar padrão da planilha" volta parâmetros e variantes a eles, sem mexer em nome e área. | valores de fábrica |
| **Primeiros passos** | Fluxo de 3 passos após o cadastro (nome da fazenda, área pastável, parâmetros); concluído uma vez por fazenda (`onboardingConcluidoEm`). | onboarding (só em código), tutorial |
| **PWA / app instalável** | A versão web instalada no aparelho, abre em janela própria e funciona sem internet. | aplicativo (reservar para o app nativo da v3) |
| **Fila de envio (outbox)** | Lançamentos feitos offline, guardados no aparelho até subirem ao servidor. | rascunho |
| **Pendente** | Registro salvo no aparelho e ainda não enviado. | não salvo |
| **Sincronização** | Envio da fila e recebimento das mudanças do servidor. | upload |
| **Conflito** | Mesmo registro alterado em dois aparelhos; o usuário decide qual manter. | erro |
| **PA-xx** | Ponto de atenção encontrado nas planilhas (`docs/negocio/01-negocio.md` §8). | — |
