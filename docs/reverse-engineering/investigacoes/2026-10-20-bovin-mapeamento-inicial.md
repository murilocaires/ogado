# Investigação BOVin — Mapeamento inicial (2026-10-20)

> **Alvo**: `https://app.bovin.com.br/`
> **Método**: observação passiva via REA + cenários Playwright do REA (ações somente de leitura).
> **Credenciais**: fornecidas pelo usuário em sessão; **não** persistidas em nenhum arquivo.
> **Escopo respeitado**: nenhum cadastro, edição, exclusão ou compra foi realizado. Somente leitura.

## Sumário executivo

O BOVin é uma aplicação **SvelteKit** ( SSR + `__data.json` ), servida atrás do
**Cloudflare**, com PWA/manifest e Google Ads. O modelo de produto é
**gestão pecuária por propriedade e safra**, com módulos de manejo de
pastagem/curral, nutrição, financeiro completo (DRE, carteiras, fluxo de caixa)
e relatórios geráveis.

## Evidências (IDs do REA)

| Evidência | Operação |
| --- | --- |
| `ev_78a2f314c0e913aa107a3267628202aa59c5856af283b63b0c6a1c0a9969beb0` | Lista de alvos CDP (página "Bem-vindo - BOVin") |
| `ev_0d23612b470d01f8f8c0a34f382426cc8b33c713d42ed49bbfae2e616c24c072` | Inspetionar página `/bem-vindo` (DOM 191 nós, 43 scripts) |
| `ev_15455c65d911ca09d1d540387fbc7375d1f4a67c27d9fe1ea1505329f8ba7c6d` | Screenshot da landing (viewport 1295×879, sha256 registrado) |
| `ev_55aa263354af3a1e2ffd52a82bed2ab76286dcdaaf1ab2d336cd8467da85d6a8` | Cenário launch: carga da landing com rede (165 eventos) |
| `ev_86fdc437a4978e3aa198dea672418dc208aa8a67382bda79bcfec47315700b1f` | Mapeamento da tela de login `/acesso` |
| `ev_b860478ea3e51d8ceeda050858de4b10c1d66a75ae2069bb09d5a6ca535916d3` | Login + dashboard `/inicio` (pós-login) |
| `ev_1165fb675615b45e58e4cbf798a80296398140ea0bd87010e780f65eea537c96` | Rebanho/Categorias + Campo |
| `ev_74eac5a8220827494daf7e7276a7e08cca1306c735b0e8e1edabe4a4dd366849` | Pastagem, Curral e Nutrição |
| `ev_afd69e27dfa10bc069f0b2368a6d0c24111a6b9060bffe5bfd127a8c391aaee6` | Financeiro, Pessoas, Estoque e Relatórios |
| `ev_d0b3c9b84b8e5980cffe4510e8f644b76599de4890b3be3989b1a4b9dfd40fa6` | Superfície de API (846 eventos de rede) |
| `ev_f71ba0b47f32ec3283c57876fcb33afab564e9fc3ee45a294375556e8277ba1b` | Rebanho → aba Movimentos |

## 1. Arquitetura técnica observada

- **Framework**: SvelteKit (rotas `_app/immutable/*`, `__data.json`, `sveltekit:snapshot`
  no session storage, header `x-sveltekit-page`).
- **SSR + dados por rota**: cada navegação busca `<rota>/__data.json` com
  `x-sveltekit-invalidated` — padrão de invalidação parcial do SvelteKit.
- **Edge**: Cloudflare (`cf-ray`, `/cdn-cgi/rum` para telemetria RUM).
- **API REST própria**: `/api/health`, `/api/propriedades/estado-assinatura`,
  `/api/logs-cliente` (telemetria de cliente).
- **Multi-tenancy**: propriedade identificada por query param `?p=<uuid>`
  em **todas** as rotas (equivalente ao `fazendaId` do O Gado).
- **Safra/periodização**: seletor de safra (ex.: "2026 - 2027") presente em toda
  a UI — o conceito central de tempo do produto.
- **PWA**: manifest + ícone com `sizes`; service workers bloqueados por padrão
  no cenário do REA (não testados).
- **Mapas**: Leaflet com tiles Google (`PropriedadeMap`, `RecintoCorIndicator`).
- **Gráficos**: componentes `LineAreaChart`, `BarChart` (biblioteca não identificada).

## 2. Navegação (informação arquitetural)

Menu lateral em 4 grupos:

| Grupo | Rotas |
| --- | --- |
| Visão Geral | `/inicio`, `/relatorios` |
| Manejo | `/pastagem`, `/curral`, `/campo` |
| Resumo | `/rebanho`, `/nutricao` |
| Negócio | `/financeiro`, `/pessoas`, `/estoque` |

Fluxo de trabalho sugerido pelo próprio app: **Pastagem → "Levar ao curral" →
Curral → "Trazer ao curral"** (o curral é um estado temporário de lotes, com
botões de transferência de categoria entre pasto e curral).

## 3. Módulos e funcionalidades

### 3.1 Rebanho (`/rebanho`) — 3 abas

- **Categorias**: tabela Categoria / Grupo Animal / Quant. / Peso Médio / Peso Total,
  com busca, filtro por grupo, exportação e ordenação por coluna.
  Indicadores no topo: cabeças, peso médio, peso total (@), lotação atual
  (U.A/ha e cab/ha), lotação da safra, @ produzidas, @/ha, GMD informado.
- **Movimentos**: tipos de movimento contabilizados no período:
  **Compra, Venda, Doação, Abate, Morte, Nascimento, Consumo, Transferência
  entre fazendas (saída e entrada)** — além do tipo observado nos dados:
  **Estoque inicial**. Tabela Data / Tipo / Pasto / Categoria / Quant. / Peso /
  Peso total com **linha de saldo acumulado**. Seletor de mês/período e
  exportação para relatório de movimentação.
- **Diário**: não explorada (aba presente).

> Observação: o **arroba (@) aparece como unidade derivada exibida ao lado do
> kg** (ex.: "2.000 kg · 66,7 @" — 66,7 @ por 500 cabeças de 2.000 kg). Isso
> indica cálculo @ = kg/30, coerente com o O Gado (ADR do projeto).

### 3.2 Pastagem (`/pastagem/pastos`)

- Cadastro de **pastos com polígono em mapa** (Leaflet + Google), 3 visões:
  Mapa / Dividido / Tabela.
- Tabela: Pasto / Trato / Área (ha) / U.A/ha, com lotes ocupantes aninhados
  (ex.: "Vaca: 500 cab • 2000 kg") e menu "Levar ao curral".
- Indicadores: pastos cadastrados, área total, animais, média, área ativa,
  lotação atual e lotação da safra.
- Relatório específico: **"Resumo pasto a pasto"**.

### 3.3 Curral (`/curral`)

- Estado vazio explicativo: "Traga um lote por aqui, ou use a opção
  'Levar ao curral' no menu de cada categoria na aba Pastos".
- Botão "Trazer ao curral".

### 3.4 Campo (`/campo`)

- Fluxo de **rota de campo offline**: "Sem rota salva neste aparelho — você está
  offline e ainda não preparou uma rota de campo aqui. Conecte-se à internet
  para escolher os pastos e baixar os dados do dia." → `/campo/preparar`.
- **Comparável ao PWA offline-first do O Gado** (ADR-0007): o BOVin separa um
  fluxo dedicado de "preparar rota" para uso no pasto.

### 3.5 Nutrição (`/nutricao/suplementos`) — 3 abas

- **Suplementos** (cadastro + "Lançar estoque"), **Insumos**, **Trato**.
- Relatório **"Trato e consumo"**: "quanto de suplemento o plano previa e quanto
  foi de fato ao cocho, por recinto e ao longo do período" → conceito de
  **plano × realizado** no trato.

### 3.6 Financeiro (`/financeiro`) — 3 abas

- **Resumo**: saldo em caixa por **carteiras** (banco, caixa, cartão) com
  transferências entre carteiras sem afetar resultado; a receber/a pagar
  previstos; resultado da safra (projetado × realizado); fluxo de caixa 12 meses;
  receitas/despesas por categoria; resultado do mês (realizado).
- **Lançamentos**: filtros por tipo (receita/despesa) e status (pendente…).
- **DRE**: demonstrativo por safra (aba própria + relatório).
- **Onboarding guiado** (coachmarks "1 de 3") — mesma técnica usada em outras telas.

### 3.7 Pessoas (`/pessoas`)

- Cadastro único de **clientes e fornecedores** com tipo, busca por nome/documento.
- "Cadastre clientes e fornecedores para vincular aos seus lançamentos e
  movimentos de animais" → pessoas são entidades ligadas a movimentos e financeiro.

### 3.8 Estoque (`/estoque/produtos`) — 2 abas

- Produtos (com **filtro de estoques críticos**, categoria) + Movimentos.
- Tipos de produto citados no onboarding: **suplemento, insumo ou produto geral**.
- Relatório **"Extrato de estoque"**: entradas/saídas por produto e local com saldo.

### 3.9 Relatórios (`/relatorios`)

Geráveis (PDF/impressão), com aba de **Histórico**:

| Categoria | Relatórios |
| --- | --- |
| Rebanho | Indicadores gerais; Resumo pasto a pasto; Rebanho por categoria; Movimentação do rebanho |
| Produção | Trato e consumo; Histórico do pasto/baia (tabela diária: movimentos, categorias, cabeças, peso, GMD, plano de trato, leitura, trato previsto e realizado) |
| Financeiro | DRE; Extrato financeiro |
| Estoque | Extrato de estoque |

### 3.10 Dashboard (`/inicio`)

Blocos: **Total da propriedade** (cabeças, GMD, estoque em @, área ativa,
lotação média U.A/ha, margem operacional/ha, faturamento/ha), **Cabeças**
(inicial/final/médio, área média, compradas/vendidas/abatidas com peso médio e
R$/@), **Arrobas** (@ inicial/final, produzidas, @/ha, variação de estoque em @
e R$, margem após estoque), **Produtivos & custos** (menor/maior/média de lotação,
suplementação kg/cab/dia e R$/cab, GMD calc. × GMD informado, resultado
Des/cab/mês, custo @ produzida, margem de prod./@, rentabilidade), **Resultado
financeiro** (tabela Total//ha//cab de Faturamento, Custo operacional,
Investimentos, Margem operacional, Margem líquida), gráficos de Despesas ×
Receitas e Lotação mensal, e **Controle mensal**.

## 4. Vocabulário de domínio observado (vs. O Gado)

| Termo BOVin | Conceito no O Gado |
| --- | --- |
| Propriedade (`?p=`) | Fazenda (`fazendaId`) |
| Safra 2026-2027 | Período/cenário |
| Categoria (Vaca…) | Categoria de lote |
| Pasto / Módulo / Trato | Pastagem (área pastável) |
| Curral | Estado de manejo temporário (sem equivalente direto) |
| @ produzidas, @/ha, GMD calc. × informado | UA/arroba, GMD (domain `recria.ts`) |
| Lotação U.A/ha e cab/ha | Lotação (ADR-0004: fixa80/areaPastavel) |
| Margem operacional/ha, Margem após estoque, Rentab. | Indicadores financeiros (domain `compra-venda.ts`) |
| Trato previsto × realizado | Plano de suplementação (proteinado) |
| DRE / carteiras / saldo em caixa | **Novo** para o O Gado (hoje sem módulo financeiro pleno) |

## 5. Superfície de API observada

- `GET /api/health`
- `GET /api/propriedades/estado-assinatura?propriedade_id=<uuid>` → modelo de **assinatura**
- `POST /api/logs-cliente` → telemetria
- `POST /cdn-cgi/rum` → Cloudflare RUM
- `GET /<rota>/__data.json?p=<uuid>&x-sveltekit-invalidated=…` → dados SSR por rota

Nenhum endpoint privado foi acessado fora do que a própria aplicação chamou.

## 6. Implicações para o O Gado (hipóteses de produto, a validar)

1. **Financeiro completo** (carteiras, DRE por safra, a pagar/receber,
   transferências) é o maior gap funcional em relação ao O Gado.
2. **"Estoque inicial" como tipo de movimento** — conceito de abertura de
   período que o O Gado resolve por cenário/safra.
3. **Nutrição com plano × realizado por trato** — detalhe operacional do
   proteinado que pode enriquecer `recria.ts` (sem alterar fórmulas sem aprovação).
4. **Fluxo "rota de campo" offline** — paralelo ao PWA do O Gado; indicador de
   que o usuário de campo é persona central.
5. **Relatório "Histórico do pasto/baia"** (tabela diária) — formato de
   apresentação valioso para o módulo de recria.
6. **Coachmarks/onboarding** em várias telas — técnica de adoção replicável.

> Nenhuma dessas hipóteses foi implementada. Toda implementação futura deve
> seguir o fluxo SDD do O Gado (spec → plan → tasks) e a Constituição.

## 7. Teste funcional interativo (autorizado pelo usuário, 2026-10-20)

O usuário autorizou explicitamente entrar e usar a plataforma "como se fosse um
usuário real, digitando dados se precisar". Os testes abaixo foram feitos no
navegador de investigação via cenários Playwright do REA.

### 7.1 Dados de teste criados na propriedade "Veneza"

| Dado criado | Detalhe | Evidência |
| --- | --- | --- |
| Categoria **"Bezerro teste"** (grupo *Bezerro mamando*) | `POST /api/categorias` → 200 | `ev_43d67853…` |
| **Transferência** 10 cab. Vaca (2.000 kg) Módulo 1 → Modulo 2 | `POST /api/manejo` → **200** | `ev_7003bc36…` |
| **Venda** 1 cab. Vaca (2.000 kg) Modulo 2 | `POST /api/manejo` → **200** | `ev_62cef1fc…` |

> Nada foi excluído. Os registros permanecem na propriedade de teste.

### 7.2 Fluxo "Registrar manejo" (dialogo único com 4 grupos)

**Transferência**: Transferência (entre pastos/baias) · Entre fazendas.
**Entradas**: Compra · Nascimento. **Saídas**: Venda · Abate · Consumo interno ·
Doação · Morte. **Outros**: Correção de estoque inicial.

Formulário de Compra/Venda/Nascimento (mesmo esqueleto):
`Data` → `Pasto ou baia` (listbox com tabs **Pasto/Baia** e ocupação atual de cada
recinto) → `Categoria` (combobox pesquisável) → `Quantidade (cab)` →
`Peso médio (kg)` → `Preço da @ (opcional, R$/@)` → `Adicionar observação` →
`Adicionar mais` (múltiplos lotes no mesmo movimento) → fornecedor/cliente
(opcional). Botão de confirmação fica **disabled** até validação.

Diálogo de **Transferência** tem o checkbox **"Manter o GMD e o plano de trato
no destino"** (marcado por padrão).

### 7.3 Regras de negócio descobertas por teste

1. **Ajuste de peso ponderado**: quando o peso informado difere do lote de
   destino, abre diálogo **"Ajustar peso dos animais"** com duas opções —
   (a) *média ponderada* (padrão; ex.: 500 cab×2.000 kg + 10×450 kg →
   510 cab×1.969,61 kg) e (b) *lançar pesagem prévia* ajustando todo o lote ao
   novo peso. Cálculo conferido e correto (média ponderada).
2. **Limites de data**: o app bloqueia data **anterior à data do estoque
   inicial** ("A data não pode ser anterior a 20/10/2026 (data do estoque
   inicial da propriedade)") e data **futura** ("Não é possível lançar um
   movimento com data futura.").
3. **Nascimento exige categoria própria**: o dropdown de categoria do
   nascimento só oferece **"Cadastrar novo"** (não sugere categorias existentes).
4. **Categorias** têm `Nome` + `Grupo animal` (enum de 10 grupos: Desmama macho,
   Desmama fêmea, Garrote, Novilha, Primípara, Vaca, Boi, Touro, Bezerro
   mamando, Bezerra mamando).
5. **Integração Rebanho → Financeiro**: após registrar uma venda, o app abre
   **"Lançar receita de venda"** (carteira "Caixa Geral", valor por lote,
   opção "Pular") — o financeiro recebe o lançamento vinculado ao movimento.
6. **Movimentos geram par entrada/saída**: transferência produz duas linhas
   ("Transferência entrada" e "Transferência saída") com quantidades negativas
   na saída; a tabela tem **linha de saldo acumulado** e coluna "Mais ações".
7. **Bug/API inobservável**: `POST /api/manejo` retorna **409 (Conflict)** para
   **Compra** e **Nascimento** em todas as variações testadas (recinto vazio ou
   ocupado, data = estoque inicial, peso igual ou diferente do lote), com
   mensagem genérica "Erro ao registrar movimento". **Transferência e Venda
   retornam 200** no mesmo endpoint. O corpo da resposta 409 não é exposto pelas
   ferramentas de captura do REA (evento `response` sem corpo retido). Causa
   não determinada; pode ser regra de servidor (ex.: estado da assinatura,
   trava de "estoque inicial") específica de entradas de rebanho.

### 7.4 Superfície de API de escrita observada

| Endpoint | Uso | Status |
| --- | --- | --- |
| `POST /api/categorias` | criar categoria | 200 |
| `POST /api/manejo` | transferência / venda | 200 |
| `POST /api/manejo` | compra / nascimento | **409** |
| `POST /api/logs-cliente` | telemetria de erros/UI | 200 |
| `GET /api/rebanho/movimentos?propriedade_id&inicio&fim` | lista de movimentos | 200 |
| `GET /api/pessoas?tipo=fornecedor&limite=50` | fornecedores no form de compra | 200 |

### 7.6 Financeiro (Lançamentos, Resumo, DRE) — testado em 2026-10-20

- **Novo lançamento** (`POST /financeiro/lancamentos?/criarLancamento` → 200,
  form action do SvelteKit, não REST). Campos: Valor, Descrição, Vencimento
  (obrigatório), Data de pagamento (**em branco = pendente**), Categoria →
  Subcategoria (dependente, com botão "Gerenciar"), Cliente (opcional),
  Carteira (padrão "Caixa Geral"), Repetição (**Único / Parcelado — valor
  dividido / Recorrente**).
- Categorias de receita disponíveis: **Venda de gado, Máquinas e implementos,
  Outros, Pastagem** (subcategoria padrão "Geral").
- Menu "Mais ações" do lançamento: **Ver · Marcar como recebido · Editar ·
  Excluir**. A baixa abre diálogo com "Data de recebimento" e confirma via
  `POST /financeiro/lancamentos?/marcarPago` → 200 (Pendente → Recebido).
- Aba **Resumo**: "Panorama da fazenda" (não muda com o mês), Saldo em caixa
  por carteira ("Não inclui vendas a receber"), A receber/A pagar previsto
  (links com filtro), Resultado da safra (realizado + projetado), Próximos
  compromissos, Fluxo de caixa 12 meses (só realizado), Receitas/Despesas por
  categoria.
- Aba **DRE**: safra cheia (jul/26–jun/27), colunas mensais + Total + **AV%**,
  margem operacional e resultado líquido; inclui o que está a pagar/receber;
  link "Baixar DRE" (`/relatorios/dre`).

### 7.7 Estoque — testado em 2026-10-20

- Cadastro de produto em 2 passos: tipo **Produto simples** (estoque próprio;
  pode ir ao cocho/entrar em receitas/ambos/nenhum) × **Produto composto**
  (BOM — "consumir debita os ingredientes", sem estoque próprio).
- Campos do simples: Nome, Categoria, marcas (suplemento no cocho / ingrediente),
  Unidade, Estoque mínimo, Estoque inicial. Marcar **suplemento** expande
  campos dinâmicos: "Habilitar leitura de cocho" (auto-marcado), Consumo
  mín./máx. **%P.V.**, unidade travada em **kg** ("o trato é calculado em
  %P.V.").
- Criação via `POST /estoque/produtos?/criarProduto` → 200 (form action).
  O estoque inicial gera um movimento de **Entrada** automático ("Estoque
  inicial", valor "—" sem custo).
- Aba Movimentos: filtros Natureza/mês, botões Entrada/Saída; tabela com
  *Tipo · Produto · Quantidade · **Saldo após** · Valor total · Data*. O
  movimento de saída foi via `POST /api/movimentos-estoque` → 200 (**REST**,
  diferente do form action do cadastro). Observação: a coluna "Saldo após" da
  linha mostrou −10 kg enquanto o produto lista 90 kg — provável saldo corrente
  por local de estoque (a saída foi em "Estoque Geral"; o produto aparece como
  tipo "Cocho"). Não confirmado.
- Colunas da tabela de produtos: Produto · Tipo · Saldo · Custo médio · Valor
  estoque · Mínimo.

### 7.8 Nutrição — mapeada em 2026-10-20

- **"Novo suplemento" reabre o mesmo modal "Cadastrar produto"** do Estoque —
  catálogo único; suplemento é produto com marca de uso.
- Aba Suplementos: tabela Nome · Tipo · Esperado · Realizado · Real. %P.V ·
  Estoque; botão "Lançar estoque".
- Aba Insumos: "ingredientes usados no preparo de **batidas**" (BOM dos
  produtos compostos); cadastro também pelo modal de batida.
- Aba Trato: visões **Calendário / Lista / Individual**; calendário por pasto
  (Módulo 1, 490 animais / Modulo 2, 9 animais) com estado por dia; dia sem
  plano não abre diálogo (só marca pressed). Indicadores: pastos "precisam de
  atenção / fora do ritmo / certos / **sem plano de trato**"; legenda "comeu o
  previsto / comeu demais / ficou sem cocho".
- Visão Individual: gráfico Previsto × Realizado em **kg ou %P.V**; tabela
  diária Data · Trato lançado · Previsto · Realizado · **Saldo no cocho** ·
  %P.V · Situação; total "Quantidade fecha".
- Fluxo de plano de trato (criação) não foi aberto — exigiria configurar o
  suplemento num pasto (fora do escopo desta rodada).

### 7.9 Pessoas — testado em 2026-10-20

- Cadastro único **Cliente e/ou Fornecedor** (combobox Tipo, default "Ambos");
  campos: Nome*, Tipo*, CPF/CNPJ, Telefone, Email, Logradouro, Número, Bairro,
  CEP, Cidade, UF, Observação.
- Criação via `POST /api/pessoas` → 200 (**REST**). Tabela: Nome · Tipo ·
  Documento · Telefone · Cidade/UF · Mais ações.

### 7.10 Relatórios — mapeado e testado em 2026-10-20

- 9 relatórios em 4 grupos: **Rebanho** (Indicadores gerais, Resumo pasto a
  pasto, Rebanho por categoria, Movimentação do rebanho), **Produção** (Trato
  e consumo, Histórico do pasto/baia), **Financeiro** (DRE, Extrato
  financeiro), **Estoque** (Extrato de estoque) + aba **Histórico**.
- Gerador (testado no de Movimentação): recorte por safra/período/pasto;
  **colunas configuráveis via checkboxes agrupados** (Identificação, Local,
  Animais, Peso, Abate e comercial — peso de carcaça, arrobas de carcaça,
  preço da @, pessoa —, Outros, Seções do documento); formatos **Excel (CSV) ·
  Excel (XLSX) · PDF**. Exportação via `POST /api/relatorios/exportar` → 200.

### 7.11 Padrões de API consolidados (escrita)

| Mecanismo | Exemplos |
| --- | --- |
| Form action SvelteKit (`POST /rota?/acao`) | criarLancamento, marcarPago, criarProduto |
| REST (`POST /api/...`) | `/api/manejo`, `/api/categorias`, `/api/movimentos-estoque`, `/api/pessoas`, `/api/relatorios/exportar` |
| Telemetria | `POST /api/logs-cliente` (200) |

### 7.12 Evidências adicionais do teste funcional (2026-10-20, tarde)

`ev_cb3db607…` (Lançamentos vazio), `ev_22e3f152…`/`ev_1279961f…` (form Novo
lançamento), `ev_e0f784d1…` (categorias de receita), `ev_87de150f…`
(lançamento preenchido), `ev_f85598b9…` (criação 200), `ev_3785f7d1…` (menu
Mais ações), `ev_25e743bc…`/`ev_8cdd857e…` (baixa marcarPago 200),
`ev_fe2c7270…` (Resumo), `ev_beb2b60b…` (DRE), `ev_260c3598…` (Estoque vazio),
`ev_a8a189c0…` (tipos de produto), `ev_01fdc7a3…`/`ev_79419a0f…` (form
simples), `ev_c4734196…` (criarProduto 200), `ev_d1051ade…` (Movimentos com
entrada automática), `ev_982304a0…` (form saída), `ev_d00eb0af…` (saída 200),
`ev_0baa990f…` (saldo 90 kg), `ev_5bc3d3f7…` (Suplementos),
`ev_3de531e4…` (targets CDP após reinício — CLI).

### 7.13 Nota de ambiente

O servidor OpenCode reiniciou no meio da sessão; o MCP `rea` não reconectou
automaticamente. A investigação continuou pela **CLI** (`npx rea-agents@6.7.0
capture-browser-scenario <arquivo.json> --format json`), com dois ajustes
obrigatórios: `environment.service_workers = "allow"` no JSON de entrada e o
caminho `normalized_result.steps` (irmão de `scenario`) ao ler o resultado.
Chrome de investigação foi relançado com o mesmo perfil temporário (sessão
persistiu); novo target `184D43C2FB997FCA96BD90751547347A`.

### 7.14 Pastagem — testado em 2026-10-20 (tarde)

- Tela com visões **Mapa (Leaflet + Google) / Dividido / Tabela** e
  indicadores: cadastrados (pastos/ha), animais (cabeças, kg de média), área
  ativa, **lotação atual e de safra em U.A/ha e cab/ha**.
- Três formas de cadastro (menu "Mais opções"): **Desenhar pasto** (polígono
  no mapa), **Cadastrar pasto** (formulário) e **Importar pastos**.
- Formulário "Novo pasto": Identificação, **Gênero do capim → Cultivar**
  (dependente), Área (ha — manual quando sem polígono), paleta de cores.
  - Gêneros: Urochloa (Brachiaria), Panicum (Megathyrsus), Cynodon,
    Andropogon, Setaria, Paspalum, Outro.
  - Cultivares de Urochloa: Marandu, Decumbens, Piatã, Xaraés, Paiaguás,
    Humidicola, Outro.
  - Criação via `POST /pastagem/pastos?/criarPasto` → 200 (form action).
- Menu "Mais opções" de cada pasto: **Abrir histórico · Dados do pasto ·
  Mostrar no mapa · Manejar animais · Dimensionar pasto · Editar pasto ·
  Inativar pasto · Arquivar pasto**.
- **Inativar ≠ Excluir**: abre gestão de **períodos de inatividade** (início,
  fim opcional, motivo — "reforma, descanso, manutenção"). Enquanto inativo o
  pasto não conta na área ativa e não aceita movimentação. O texto do diálogo
  diz explicitamente "Diferente de excluir".
- **Arquivar** é o soft delete: "sai da lista, mas o histórico é preservado —
  pode restaurar depois em **Arquivados**". Ação via
  `POST /pastagem/pastos?/excluirPasto` → 200 (nome REST ≠ UX).
- Tabela: Pasto · Trato · Área · U.A/ha · Cabeças · Peso médio · Lotação
  média · Último supl. · Dose do trato · Categoria/Qnt/Peso/GMD por linha.

### 7.15 Curral — testado em 2026-10-20 (tarde)

- Tela com quatro seções: **No curral · Apartação · Venda · Abate** (vazias
  por padrão). Fluxo de entrada: botão **"Trazer ao curral"** (ou "Levar ao
  curral" pelo menu da categoria em Pastos).
- Diálogo "Trazer ao curral": Pasto (listbox com abas Pasto/Baia) → Categoria
  (dependente, mostra "X cab · Y kg") → confirmação. Executado com sucesso
  para o Modulo 2 (9 vacas, 450 kg): `POST /api/curral` → 200 (**REST**).
- Menu "Mais ações" do lote no curral: **Apartar · Separar para venda ·
  Separar para abate · Atualizar peso · Evoluir categoria · Devolver ao
  pasto**.
- Diálogo **Apartar**: quantidade e peso pré-preenchidos do lote, pasto de
  destino opcional.
- **Devolver ao pasto** executa direto, sem diálogo; lote retorna ao pasto de
  origem (verificado: Modulo 2 restaurado com 9 cab · 450 kg).
- Onboarding próprio do curral ("Animais no curral — apartar, vender ou
  abater"), 4 dicas.

### 7.16 Campo — mapeado em 2026-10-20 (tarde)

- Módulo **offline-first (PWA)**: sem rota salva, mostra "Você está offline"
  e orienta preparar a rota. Fluxo: **/campo/preparar** → escolher pastos →
  **"Salvar dados neste dispositivo"** (cache para leituras/tratos sem
  internet) e **"Salvar esta seleção como rota"**; opções "Rotas prontas" e
  "Copiar rota de ontem" (desabilitadas sem histórico).
- Preload dos dados via `POST /api/offline/preload` → 200 (+ telemetria
  própria `POST /api/telemetria`).
- Tela do dia: lista "Pastos do dia" + resumo do pasto selecionado (cabeças,
  peso médio, GMD). As ações de **leitura de cocho / trato** só aparecem com
  plano de trato ativo no pasto ("Este pasto não tem plano de trato ativo").

### 7.18 Diário do Rebanho — mapeado em 2026-10-20 (tarde)

- Aba **Diário** do Rebanho: tabela diária **Data · U.A · Cabeças · U.A/ha ·
  Cab/ha** desde o início da safra (01/07/2026 – 20/10/2026), com seletor de
  período e seletor de mês.
- Exemplo: linha 20/10/2026 = 2.187 U.A · 499 cabeças · 276,1 U.A/ha ·
  63 cab/ha (dia do estoque inicial; dias anteriores zerados).

### 7.19 Plano de trato — criado e testado em 2026-10-20 (tarde)

- O plano **não nasce em Nutrição** (nem no menu do suplemento, nem nas visões
  Calendário/Lista/Individual do Trato, nem no menu da categoria em Pastagem).
- Fluxo real: **Pastagem → tabela → clicar na célula da coluna "Trato"** abre
  o painel diário do pasto (indicadores + tabela Dia · Movimentos · Categoria
  · Cab. · Peso · GMD · Plano de trato · Leitura · Trato previsto · Trato
  realizado), com botão **"Adicionar plano"** em cada dia.
- Diálogo **"Novo plano de trato"**: Suplemento (busca/cadastro inline),
  Início, Fim (opcional), **Consumo inicial (%) e Consumo máximo (% do
  P.V.)**, agenda (**"A cada N dias"** — padrão todos os dias — ou **"Em dias
  da semana"**), **Qtd de tratos/dia** (1..N). Criação via
  `POST /api/historico-recinto/plano-trato` → 200.
- Plano criado (Modulo 2, Sal mineral teste, 1,0–1,5% P.V., todos os dias):
  Nutrição → Trato → Lista passou a mostrar **"Modulo 2 · 9 animais · Sal
  mineral teste — 41 kg (1,0% P.V.) previstos"**; situação "Nenhum trato
  lançado no mês". Indicadores: 1 pasto "precisa de atenção", 1 "sem plano".
- O painel diário do pasto também permite **"Registrar movimento"** por dia e
  **lançar GMD** por linha (textbox na coluna GMD).
- **Campo (offline) não reconheceu o plano novo**: após criar o plano, o app
  mostrava "Plano novo disponível — atualizar rota"; após "Atualizar"/re-salvar
  a rota, o pasto continuava "Sem plano de trato ativo" (provável bug ou
  invalidação de cache do PWA — comportamento observado, não confirmado).

### 7.20 Evidências do teste funcional (manejo, 2026-10-20)

`ev_2d8c1692…`, `ev_9131c4f2…` (onboarding coachmarks — descartáveis via
"Pular dicas"), `ev_119fb81a…` (grupo do diálogo de manejo),
`ev_a6d1c197…` (form Comprar), `ev_52765bad…` (listbox de recintos),
`ev_f17ddddb…`, `ev_7514c2a8…` (listbox de categorias), `ev_ed29b583…`
(form completo preenchido), `ev_d8544ab2…` (409 na compra),
`ev_2190333d…` (validação de data anterior), `ev_32fe7989…` (validação data
futura), `ev_16106634…`–`ev_1baef661…` (fluxo nascimento e enum de grupos),
`ev_43d67853…` (criação de categoria, 200), `ev_5984bd66…` (409 no nascimento),
`ev_7003bc36…` (transferência 200 + saldo), `ev_62cef1fc…` (venda 200 +
diálogo de receita), `ev_f5eb058f…` (409 na compra mesmo com peso igual).

## 8. Limitações desta investigação

- O desenho de pasto no mapa (polígono Leaflet) e a **Importar pastos** não
  foram testados — cobertura feita pelo formulário e pelas ações do menu.
- Leitura de cocho e trato lançados de fato no **Campo** não puderam ser
  testados: o app offline não reconheceu o plano de trato recém-criado (ver
  §7.19).
- O 409 de **Compra/Nascimento** em `/api/manejo` segue sem causa confirmada
  (corpo da resposta não recuperável); testado com pesos plausíveis também
  sem sucesso — hipótese restante: regra de servidor não exposta.
- `export_web_scripts` não executado — possível próximo passo para mapear
  regras de cálculo executadas no cliente.
- Dados observados pertencem à propriedade de teste do usuário ("Veneza",
  500 cabeças de estoque inicial) — valores não são reais de produção.
  Dados de teste criados durante o estudo permanecem na propriedade (categoria
  "Bezerro teste", receita de R$ 1.500, produto "Sal mineral teste", pessoa
  "Fornecedor de teste - O Gado", plano de trato no Modulo 2); o pasto de
  teste foi arquivado.
