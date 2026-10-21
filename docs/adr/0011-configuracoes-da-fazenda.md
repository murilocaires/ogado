# ADR-0011 — Configurações da fazenda: parâmetros, variantes, versão otimista e primeiros passos (T-05)

**Status:** aprovado pelo humano em 2026-10-18 (colunas tipadas, só PATCH com versão otimista, 409 com a fazenda atual, DELETE sem corpo com `?version=N` no T-06; decisões Q1–Q4 abaixo) · **Data:** 2026-10-18

> **Atualização (ADR-0013):** o parâmetro continua `descontoVendaKgCab` (10 kg/cab.); a troca por `descontoVendaPct` do ADR-0012 foi revertida. Histórico (ADR-0012): `descontoVendaKgCab` passa a `descontoVendaPct` (RN-025) e primeiros passos / tela de parâmetros dependem das decisões Q-C e Q-D. Ver ADR-0012.
**Requisitos:** RF-003, RF-011, RN-021, RN-023, RN-009, RN-017, RNF-001, RNF-003, RNF-004, RNF-007 · **Relacionados:** ADR-0003, ADR-0004, ADR-0007, ADR-0008, ADR-0010

## Contexto
O T-04 criou a Fazenda (tenant) com a convenção sincronizável (`id` UUID do servidor, `version`, `updatedAt` do servidor, `deletedAt`). O T-05 precisa guardar por fazenda o nome, a área pastável, os 9 parâmetros padrão da RN-021 e as 2 variantes da RN-023, marcar os primeiros passos como concluídos guardar o nome da pessoa (Q1) e permitir edição concorrente segura entre dois aparelhos (ADR-0007 §6). O domínio já recebe variantes e parâmetros por argumento (`calcularRecria`, `calcularCompraVenda`), sem estado global.

## Decisão

### 1. Modelo: colunas tipadas na própria Fazenda (não JSON, não tabela à parte)
- A configuração é 1:1 com a fazenda e sincroniza **como parte da entidade Fazenda**: uma única `version`/`updatedAt` cobre nome, área, parâmetros, variantes e o estado dos primeiros passos. O conflito é por fazenda inteira (aceitável com 1 usuário e até 2 aparelhos).
- **Colunas**, não JSON: tipo e escala garantidos pelo Postgres, `Decimal` sem passar por `number`, migração explícita. Parâmetro novo exige migração, o que é desejável (parâmetro/variante nova exige ADR, ADR-0008 §6).
- Campos novos (migração **aditiva**, NOT NULL com `DEFAULT` = padrão da planilha, para as fazendas do T-04 já nascerem com o padrão):

| Campo | Padrão | Tipo (ADR-0003) | Unidade na API | Usado em |
|---|---|---|---|---|
| `donoNome` (coluna `Usuario.nome`) | nulo até o passo 1 | `String?` (1–80 caracteres) | texto | passo 1 dos primeiros passos; exibido como o nome da pessoa |
| `areaPastavelHa` | nulo até o passo 2 | Decimal(12,2), nulo | ha | entrada padrão `area` do simulador; variante `areaPastavel` |
| `arrobaVivoKg` | 30 | Decimal(10,3) | kg | compra (RN-001) e @ na venda da recria (RN-011/RN-017) |
| `arrobaCarcacaKg` | 15 | Decimal(10,3) | kg | venda (RN-002) e @ de carcaça (RN-013) |
| `descontoVendaKgCab` | 10 | Decimal(10,3) | kg/cab | venda (RN-002) |
| `uaKg` | 450 | Decimal(10,3) | kg | UA (RN-008, RN-010) |
| `rendCarcaca` | 0.52 | Decimal(7,6) | fração | entrada padrão do simulador (RN-013) |
| `imposto` | 0.015 | Decimal(7,6) | fração | entrada padrão do simulador (RN-014) |
| `consumoPct` | 0.003 | Decimal(7,6) | fração | entrada padrão do simulador (RN-012) |
| `precoSuplKg` | 2.00 | Decimal(14,2) | R$/kg | entrada padrão do simulador (RN-012) |
| `sanidadeCabMes` | 2.50 | Decimal(14,2) | R$/cab/mês | entrada padrão do simulador (RN-015) |
| `varianteLotacaoInicial` | `fixa80` | enum | — | RN-009 / RN-023 |
| `varianteFaturamentoBruto` | `pesoVivo` | enum | — | RN-017 / RN-023 |
| `onboardingConcluidoEm` | nulo | timestamptz(3), nulo | ISO 8601 | redirecionamento pós-login |

- **Um campo por valor (RN-020)**: a @ de 30 kg da compra e a da recria são o mesmo parâmetro; a @ de 15 kg da venda e a de carcaça também (RN-021 lista cada valor uma vez; `WebConfig` mostra "Arroba na compra" e "Arroba na venda"). O mapeamento para os nomes do domínio fica num único lugar do domínio (item 5).
- **Os 80 ha fixos da variante `fixa80` não são parâmetro editável**: não constam da RN-021 nem do design; quem quer outro divisor escolhe `areaPastavel`. Continuam no domínio (`PARAMETROS_PADRAO.lotacaoFixaHa`).
- Os 5 últimos parâmetros (rendimento, imposto, consumo, proteinado, sanidade) são **valores iniciais** do simulador (T-07): o simulador abre com eles e o usuário pode mudá-los na simulação. Os 4 primeiros e as variantes entram direto nas fórmulas.
- **Fonte única do padrão**: os valores padrão vivem no domínio. O `DEFAULT` do banco repete os números e um teste compara a fazenda recém-criada com o padrão do domínio (divergência quebra a suíte).
- **Nome da pessoa (Q1, aprovada)**: o passo 1 pede também o nome da pessoa. Modelo mínimo: coluna aditiva `Usuario.nome` (nulável, sem `DEFAULT`; o cadastro do T-04 **não** exige nome, o onboarding preenche). Como a v1 tem 1 fazenda por conta (1:1), o nome trafega **dentro da Fazenda** como `donoNome` e é gravado pelo mesmo `PATCH /fazendas/:id` (campo `donoNome`), na mesma transação e coberto pela mesma `version` da Fazenda; assim o 409 devolve tudo em `atual`. Quando houver equipe/convite (fora da v1), o nome migra para um recurso de usuário próprio sem mudar a coluna.
- **Fora do modelo nesta fase** (sem requisito): município, UF, área total, "o que você faz?", equipe, Google Sheets (aparecem no design; ficam para quando houver requisito).

### 2. Formato na API
- Decimal trafega como **string canônica**: ponto decimal, sem sinal, sem notação exponencial, sem zeros à direita na resposta (`"30"`, `"0.52"`, `"2.5"`). Percentuais trafegam como **fração** (igual ao domínio); a tela converte de/para "%" com aritmética decimal.
- Entrada com mais casas que a escala da coluna é **rejeitada** (400, regra `casas_decimais`), nunca arredondada em silêncio.
- A resposta da Fazenda (`GET /fazendas/:id`, `GET /fazendas`, `GET /auth/session`, `PATCH`) passa a ter `areaPastavelHa`, `parametros` (9 campos), `variantes` (2 campos) e `onboardingConcluidoEm`, além dos campos atuais.

### 3. Rotas: só `PATCH /fazendas/:id` (sem PUT, sem rota de "restaurar")
- `PATCH /fazendas/:id`, corpo JSON **estrito** (chave desconhecida = 400): `version` (obrigatória, a versão-base que o cliente leu) e ao menos um de `nome`, `donoNome`, `areaPastavelHa`, `parametros` (parcial), `variantes` (parcial), `concluirOnboarding: true`. `id`, `updatedAt`, `deletedAt` e `onboardingConcluidoEm` não são aceitos no corpo.
- **PUT rejeitado**: cada passo dos primeiros passos e cada seção das configurações altera só parte da fazenda; substituição total obrigaria o cliente a reenviar tudo e aumentaria conflitos falsos.
- **Restaurar padrão = PATCH com os valores padrão do domínio** (os 9 parâmetros e as 2 variantes; nome e área ficam como estão). Rota própria foi rejeitada: no T-14 toda mutação vira item genérico da fila de envio, e um PATCH comum já é atômico e idempotente quanto ao resultado.
- **Primeiros passos concluídos = estado da fazenda** (`onboardingConcluidoEm`), gravado por `concluirOnboarding: true`. Só é aceito se a fazenda (depois do patch) tiver `nome`, `donoNome` e `areaPastavelHa`; senão 400 com os campos faltantes. É definitivo e idempotente: repetir mantém a data original. O progresso intermediário é o próprio estado salvo (nome da pessoa, nome da fazenda e área), sem passo guardado no aparelho.

### 4. Controle de versão otimista (ADR-0007 §6, RF-076)
- A escrita é um `update` condicionado a `id` + dono + `deletedAt` nulo + `version = versão-base`. Aceita: `version + 1` e `updatedAt` do relógio do servidor (o cliente não escolhe nenhum dos dois).
- Versão-base diferente da do servidor (atrás **ou** à frente) → **409 `conflito`** com o envelope de erro e a fazenda atual do servidor: `{ erro: { codigo: "conflito", mensagem }, atual: <Fazenda> }`. Nada é gravado. A tela pergunta "Manter o meu" (reenvia as mudanças com a versão do servidor) ou "Usar o do servidor". Nunca sobrescreve em silêncio.
- Fazenda que não é do tenant, id inexistente ou fazenda com lápide → **404 `nao_encontrado`** com corpo idêntico nos três casos (ADR-0010 d.3). Como a sessão já fica inválida quando a fazenda tem lápide, na prática esse caso responde 401.
- Não existe rota de exclusão da Fazenda na v1: excluir a fazenda é excluir a conta (RNF-009, fora deste ticket). A lápide da Fazenda continua coberta pelo repositório.

### 5. Domínio recebe a configuração por argumento (RN-023)
- O domínio expõe o **padrão da configuração** (montado a partir dos padrões que já existem, sem repetir números) e uma função pura que traduz uma configuração da fazenda em `{ variantes, parâmetros da recria, parâmetros de compra e venda, entradas iniciais do simulador }`. Nada é lido de estado global.
- Snapshot: quem salvar uma simulação (T-08) guarda as variantes e os parâmetros que o resultado devolve; mudar a configuração depois não recalcula nada salvo. O T-05 só garante que o cálculo depende exclusivamente dos argumentos.

### 6. Validação (Zod nas bordas, mensagens pt-BR)
- Um único schema em `@bovaro/contracts` serve à API e aos formulários. **Não há faixas de negócio** (Q2, revisada): o pecuarista digita o que quiser; a validação é só técnica e feita sobre a string, sem `number`.
- Regras técnicas, por parâmetro (`regra` no erro de campo):
  - `formato`: string decimal canônica de entrada (`^\d+(\.\d+)?$`: ponto decimal, sem sinal, sem expoente, sem vírgula, sem separador de milhar); número JSON, `null`, vazio, `"1,5"`, `"1e3"`, `"-1"`, `"NaN"`, `"Infinity"` são recusados. Não negativo e finito decorrem do formato.
  - `faixa` (técnica): `arrobaVivoKg` (@ na compra), `arrobaCarcacaKg` (@ na venda), `uaKg` e `areaPastavelHa` estritamente > 0 (são divisores); percentuais (`rendCarcaca`, `imposto`, `consumoPct`) no máximo 100% (fração ≤ 1); os demais (`descontoVendaKgCab`, `precoSuplKg`, `sanidadeCabMes`) aceitam zero; excedente à capacidade da coluna (parte inteira maior que `precisão − escala`) também é `faixa`.
  - `casas_decimais`: mais casas que a escala da coluna (zeros à direita não contam, pois não há perda). Nunca se arredonda em silêncio; a recusa é 400.
- Mensagens em pt-BR dizem o campo e a regra, sem ecoar o valor (ex.: "A @ na venda deve ser maior que zero.", "O rendimento de carcaça deve ser no máximo 100%.", "O rendimento de carcaça aceita no máximo 6 casas decimais."; a API trabalha com a fração).
- Texto: `nome` e `donoNome` com `trim`, 1–80 caracteres.
- Campos de tela seguem a RNF-007 (`parseNumeroPtBr`: só vírgula decimal; `1.500` e `1.5` rejeitados com dica).
- **Lotes guardam os parâmetros vigentes (Q3, aprovada)**: mudar a @ ou o desconto nas configurações **não** recalcula lotes de compra e venda já lançados; o lote guarda os parâmetros vigentes na época do lançamento, como a simulação salva (RN-023). Vale para T-06/T-17; o T-05 só registra a regra.

### 7. CSRF: PATCH com JSON; decisão para DELETE sem corpo (vale a partir do T-06)
- `PATCH`/`PUT`/`POST` continuam exigindo `Origin` permitido, `Sec-Fetch-Site` same-origin/same-site quando presente e `Content-Type: application/json` (ADR-0010 e).
- **DELETE** (primeira rota no T-06): **sem corpo**, com a versão-base na query (`?version=N`, validada por Zod). O plugin de CSRF deixa de exigir `Content-Type` **só** para DELETE **sem corpo** (sem `content-length` > 0 nem `transfer-encoding`); continua exigindo `Origin` e `Sec-Fetch-Site`. DELETE com corpo → 403. Justificativa: DELETE não é método "simples" do CORS (sempre gera preflight) e formulário HTML não envia DELETE, então a barreira do `Content-Type` não acrescenta nada; exigir corpo em DELETE é frágil diante de proxies e do Fastify (corpo JSON vazio dá 400).
- Alternativas rejeitadas para DELETE: corpo JSON `{ version }` (semântica indefinida na RFC 9110, proxies podem descartar); cabeçalho `If-Match` (segundo mecanismo de versão além do usado no PATCH).

## Consequências
- Uma migração aditiva; nenhum dado existente muda além de ganhar os padrões.
- Conflito por fazenda inteira: editar o nome num aparelho e um parâmetro no outro também pergunta. Aceito na v1.
- O T-06 aplica a regra de DELETE e repete o padrão de versão otimista; o T-07 abre o simulador com as entradas iniciais da fazenda; o T-08 guarda o snapshot; o T-14 leva o PATCH para a fila de envio sem mudar o contrato.
- Sem faixas de negócio: um valor absurdo (520% de rendimento é barrado por passar de 100%; uma @ de 5 kg não é) é responsabilidade do pecuarista e da conferência na tela. Se o pecuarista pedir faixas depois, mudam só o schema de contrato.
- Números das variantes no exemplo de ouro aprovados (Q4): lotação 0,24 UA/ha; bruto de carcaça R$ 282.846,18; líquido R$ 113.286,75 (`origem: "nao-planilha"`).
