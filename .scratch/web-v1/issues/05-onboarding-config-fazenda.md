# 05 (T-05): Primeiros passos e configurações da fazenda

**What to build:** os primeiros passos em 3 passos (passo 1: seu nome e o nome da fazenda; passo 2: área pastável; passo 3: parâmetros e variantes), retomáveis se interrompidos, e a tela de configurações com os 9 parâmetros de cálculo, as 2 variantes de fórmula com ajuda em linguagem simples, e "Voltar aos valores da planilha". Tudo persiste na Fazenda (colunas tipadas, uma só `version`), com controle de versão otimista (409 com a versão do servidor). O redirecionamento pós-login passa a depender dos primeiros passos. Nesta fase as duas telas exigem internet (o local-first é do T-14). Decisões em **ADR-0011** (aprovado em 2026-10-18).

**Blocked by:** 04 (concluído; aguardando revisão humana)

**Status:** ready-for-agent. ADR-0011 aprovado e Q1–Q4 respondidas em 2026-10-18. Etapa 1 (backend) implementada; etapa 2 (front) pendente.

**Reqs:** RF-003, RF-011, RN-021, RN-023 (RN-009 e RN-017 nas variantes), RNF-001, RNF-003, RNF-004, RNF-007, RF-050 (estados destas telas), RF-076 (só o contrato de conflito da Fazenda) · **Seams:** (1) rotas HTTP da API com Postgres real; (2) função pura do domínio que traduz a configuração em argumentos de cálculo; (3) telas com repositório falso + e2e (Playwright, API real)

## Contrato (resumo do ADR-0011)
- **Fazenda** ganha: `donoNome` (nome da pessoa, vem de `Usuario.nome`, nulo até o passo 1; o cadastro do T-04 não exige nome), `areaPastavelHa` (nulo até o passo 2), `parametros` { `arrobaVivoKg` 30, `arrobaCarcacaKg` 15, `descontoVendaKgCab` 10, `uaKg` 450, `rendCarcaca` 0.52, `imposto` 0.015, `consumoPct` 0.003, `precoSuplKg` 2, `sanidadeCabMes` 2.5 }, `variantes` { `lotacaoInicial` `fixa80`|`areaPastavel`, `faturamentoBruto` `pesoVivo`|`carcaca` }, `onboardingConcluidoEm` (nulo). Decimais como string canônica, percentuais como fração.
- **`PATCH /fazendas/:id`**: corpo JSON estrito com `version` (base) e ao menos um de `nome`, `donoNome`, `areaPastavelHa`, `parametros` (parcial), `variantes` (parcial), `concluirOnboarding: true`. 200 com a Fazenda; 400 `validacao_invalida`; 404 `nao_encontrado`; 409 `{ erro: { codigo: "conflito", mensagem }, atual: Fazenda }`.
- Sem PUT, sem rota de restaurar (restaurar = PATCH com o padrão do domínio), sem DELETE da Fazenda.
- Rotas web: `/primeiros-passos`, `/configuracoes`; `/painel` existente.

## Critérios de aceite

### Etapa 1 — backend (API, contrato, domínio)

**Modelo e leitura (RF-011, RN-021, RN-023)**
- [ ] **CA-01** Dado uma fazenda recém-cadastrada (ou uma fazenda do T-04 depois da migração), quando a leio, então `parametros` e `variantes` são exatamente o padrão do domínio, `donoNome`, `areaPastavelHa` e `onboardingConcluidoEm` são nulos e `version` = 1. O teste compara com o padrão exportado pelo domínio, não com números copiados.
- [ ] **CA-02** Dado qualquer leitura da Fazenda (`GET /fazendas/:id`, `GET /fazendas`, `GET /auth/session`, resposta do PATCH), quando inspeciono os decimais, então são strings canônicas (ponto, sem sinal, sem expoente, sem zeros à direita, ex.: `"0.52"`, `"2.5"`) e percentuais vêm em fração.

**Escrita com versão otimista (RF-011, ADR-0007 §6)**
- [ ] **CA-03** Dado a fazenda na versão 1, quando envio `PATCH` com `version: 1` e `nome`/`donoNome`/`areaPastavelHa`, então recebo 200 com os novos valores (o nome da pessoa é gravado em `Usuario.nome` na mesma transação), `version` = 2 e `updatedAt` maior que o anterior, mesmo que o corpo tente mandar outro `updatedAt` (esse corpo é rejeitado, ver CA-07). Fecha a segunda metade do CA-14 do T-04 pela rota.
- [ ] **CA-04** Dado duas edições feitas a partir da mesma versão 1, quando a segunda chega depois da primeira, então a segunda recebe 409 `conflito` com `atual.version` = 2 e os valores da primeira, e nada da segunda é gravado. Versão-base à frente da do servidor também dá 409.
- [ ] **CA-05** Dado duas requisições concorrentes com a mesma versão-base, quando chegam juntas, então exatamente uma recebe 200 e a outra 409 (update condicionado à versão, sem ler-e-depois-gravar).
- [ ] **CA-06** Dado um `PATCH` só com `parametros: { rendCarcaca: "0.5" }`, quando aceito, então só esse parâmetro muda; os outros 8, as variantes, o nome e a área ficam iguais.

**Validação (RN-021, RNF-001, ADR-0011 §6)**
- [ ] **CA-07** Dado um corpo com chave desconhecida ou proibida (`id`, `updatedAt`, `deletedAt`, `onboardingConcluidoEm`, `parametros.lotacaoFixaHa`), sem `version`, ou sem nenhuma mudança além de `version`, quando envio, então recebo 400 `validacao_invalida` com o caminho do campo e nada muda.
- [ ] **CA-08** Dado um valor tecnicamente inválido: fora da regra (`uaKg: "0"`, `arrobaVivoKg: "0"`, `arrobaCarcacaKg: "0"`, `areaPastavelHa: "0"`, `rendCarcaca: "1.01"`, `imposto: "-0.01"`), em formato inválido (`"1,5"`, `"1e3"`, `"-1"`, `"NaN"`, vazio, número JSON em vez de string) ou com mais casas que a coluna (`rendCarcaca: "0.5234567"`), quando envio, então recebo 400 com `caminho`, `regra` (`faixa`, `formato`, `casas_decimais`) e mensagem pt-BR, sem ecoar o valor; nada é arredondado nem gravado. Não existem faixas de negócio (Q2 revisada): valores como `uaKg: "1"`, `arrobaVivoKg: "5"` ou `rendCarcaca: "0.9"` são aceitos; `rendCarcaca: "1"` (100%) é aceito.
- [ ] **CA-09** Dado `nome` ou `donoNome` com espaços nas pontas, quando salvo, então é gravado sem eles; nome vazio (após remover espaços) ou com mais de 80 caracteres dá 400.
- [ ] **CA-10** Dado uma variante fora da lista (`lotacaoInicial: "fixa100"`), quando envio, então recebo 400 e a variante não muda.

**Restaurar padrão e primeiros passos (RN-021, RF-003)**
- [ ] **CA-11** Dado uma fazenda com 3 parâmetros e as 2 variantes alterados, quando envio `PATCH` com o padrão completo do domínio, então `parametros` e `variantes` voltam ao padrão (iguais aos do CA-01), `nome` e `areaPastavelHa` ficam como estavam e `version` avança.
- [ ] **CA-12** Dado uma fazenda sem `nome`, sem `donoNome` ou sem `areaPastavelHa`, quando envio `concluirOnboarding: true` (sozinho ou junto com os campos que faltam), então só é aceito se, depois do patch, `nome`, `donoNome` e `areaPastavelHa` existirem; senão 400 com os campos faltantes e `onboardingConcluidoEm` continua nulo.
- [ ] **CA-13** Dado os primeiros passos já concluídos, quando envio `concluirOnboarding: true` de novo, então recebo 200 e `onboardingConcluidoEm` mantém a data original.

**Isolamento e segurança (RF-010, RNF-003, RNF-004; fecha CA-11/CA-15 do T-04 na escrita)**
- [ ] **CA-14** Dado as fazendas A e B, quando o usuário A envia `PATCH /fazendas/<id de B>` com um corpo válido e a versão correta de B, então recebe 404 `nao_encontrado` com corpo idêntico ao de um UUID inexistente, e a linha de B no banco (valores, `version`, `updatedAt`) fica igual byte a byte.
- [ ] **CA-15** Dado o teste-guardião do T-04, quando a suíte roda, então a nova rota `PATCH /fazendas/:id` aparece coberta pela suíte de isolamento (o guardião falha se for removida da suíte).
- [ ] **CA-16** Dado um `PATCH` sem `Origin` permitido, com `Sec-Fetch-Site: cross-site` ou com `Content-Type: text/plain`, quando chega, então recebo 403 `requisicao_bloqueada` e nada muda; o preflight CORS de `PATCH` da origem permitida passa com credenciais.
- [ ] **CA-17** Dado uma fazenda com lápide (`deletedAt` preenchido pelo repositório), quando o dono tenta ler ou alterar, então recebe 401 (sessão inválida, comportamento do T-04) e o repositório devolve "não encontrada" para update; não existe rota de exclusão da Fazenda.

**Domínio recebe a configuração por argumento (RN-023, RN-009, RN-017)**
- [ ] **CA-18** Dado a configuração padrão, quando a traduzo para argumentos de cálculo e calculo a recria e a compra e venda do exemplo de ouro, então os resultados batem com o ouro (≤ 1e-6 relativo): líquido R$ 102.408,0529717073 e saldo −R$ 89.475,8333….
- [ ] **CA-19** Dado `arrobaCarcacaKg` = 16 na configuração, quando calculo a venda do ouro (16 cab., 2.920 kg), então as @ são (2.920 − 160) ÷ 16 = 172,5 (`origem: "nao-planilha"`, conta à mão revisada pelo humano), provando que o mesmo parâmetro alimenta a venda e a @ de carcaça.
- [ ] **CA-20** Dado o cálculo com a configuração X, depois com Y, depois com X de novo, quando comparo o primeiro e o terceiro resultado, então são iguais e cada resultado devolve as variantes e os parâmetros efetivamente usados (snapshot para o T-08); nada depende de estado global.

### Etapa 2 — front (telas, estados, e2e)

**Redirecionamento (RF-003)**
- [ ] **CA-21** Dado uma sessão cuja fazenda não concluiu os primeiros passos, quando entro, me cadastro ou abro `/painel` ou `/configuracoes`, então vou para `/primeiros-passos`; com os primeiros passos concluídos, entrar leva a `/painel` e abrir `/primeiros-passos` também leva a `/painel`. Sem sessão, `/primeiros-passos` e `/configuracoes` levam a `/entrar`. Os testes do T-04 que esperavam `/painel` após o cadastro passam a esperar `/primeiros-passos`.

**Primeiros passos (RF-003)**
- [ ] **CA-22** Dado o passo 1 ("Sua fazenda": seu nome e o nome da fazenda) e o passo 2 ("Área pastável", ha), quando toco em Continuar com o campo vazio ou inválido, então vejo o erro em pt-BR junto ao campo, o foco vai para o primeiro campo com erro e não avanço; com valor válido, o passo é salvo no servidor e avanço. "Voltar" mantém o que já digitei. O indicador mostra "Passo N de 3".
- [ ] **CA-23** Dado a área pastável digitada como `1.500` ou `1.5`, quando continuo, então vejo a dica para usar vírgula (RNF-007); `1.500,5` e `102` são aceitos.
- [ ] **CA-24** Dado que salvei o passo 1 e fechei o navegador, quando entro de novo, então volto para o passo 2 com o seu nome e o nome da fazenda já preenchidos (passo 1 completo = `donoNome` e `nome` salvos); se os passos 1 e 2 estiverem salvos, volto ao passo 3. O passo atual vem só do estado da fazenda no servidor (nada guardado no aparelho).
- [ ] **CA-25** Dado o passo 3, quando ele abre, então mostra os 9 parâmetros já preenchidos (padrão da planilha ou os salvos), percentuais em "%" (52, 1,5, 0,3) e as 2 variantes com o padrão marcado e o selo "como na planilha"; "Concluir" envia parâmetros, variantes e `concluirOnboarding` numa só requisição e mostra "Tudo pronto" com "Abrir meu painel", que leva a `/painel`.
- [ ] **CA-26** Dado um percentual digitado como "1,5", quando salvo, então a API recebe `"0.015"` (conversão decimal, sem `number`); "52" vira `"0.52"`; o caminho inverso exibe "52" e "1,5".

**Configurações (RF-011, RN-021, RN-023)**
- [ ] **CA-27** Dado `/configuracoes`, quando abre, então tem as seções "Fazenda" (seu nome, nome da fazenda, área pastável), "Parâmetros de cálculo" (Compra e venda: @ na compra, @ na venda, desconto; Recria: UA, rendimento, imposto, consumo, proteinado, sanidade) e "Fórmulas" (as 2 variantes), e um selo "padrão da planilha" ou "personalizado" conforme os valores. "Salvar" fica desabilitado sem alterações; após salvar, aparece "Configurações salvas. Valem para os próximos cálculos; simulações já salvas não mudam."
- [ ] **CA-28** Dado o seletor de variantes, quando o leio, então cada opção tem título e ajuda em linguagem simples (textos abaixo), e os números do exemplo citados na ajuda são gerados pelo domínio a partir do exemplo de ouro (um teste compara o texto exibido com o cálculo arredondado; nada de número digitado à mão no componente).
- [ ] **CA-29** Dado parâmetros e variantes alterados, quando toco em "Voltar aos valores da planilha", então um diálogo de confirmação lista o que volta ao padrão (9 parâmetros e 2 variantes) e avisa que nome e área não mudam; "Cancelar" não altera nada; "Voltar ao padrão" salva e a tela mostra os valores padrão com o selo "padrão da planilha".
- [ ] **CA-30** Dado que a fazenda foi alterada em outro aparelho, quando salvo e a API responde 409, então vejo "Estas configurações foram alteradas em outro aparelho." com "Manter o meu" (reenvia minhas mudanças sobre a versão do servidor) e "Usar o do servidor" (substitui o formulário pelos valores de `atual`); nada é sobrescrito sem a escolha. O mesmo vale nos primeiros passos.

**Estados, acessibilidade e responsivo (RF-050, RNF-005, RNF-006)**
- [ ] **CA-31** Dado as duas telas, quando carregam, então mostram estado de carregando (`aria-busy`) sem piscar campos vazios; erro 500 mostra mensagem com `requestId` e "Tentar de novo"; 400 marca os campos com a mensagem do servidor; 401 leva à tela de entrar sem aviso de sessão expirada e sem apagar dados locais (contrato do T-04).
- [ ] **CA-32** Dado o aparelho sem conexão, quando abro ou tento salvar, então vejo "Sem conexão. Os primeiros passos e as configurações precisam de internet nesta versão." com "Tentar de novo", e os valores digitados continuam na tela (sem fila local; isso é do T-14).
- [ ] **CA-33** Dado as duas telas em 360 px e 1440 px, quando passo axe e navego só pelo teclado, então não há violações, os alvos têm ≥ 44 px, as variantes são um grupo de rádio com setas, cada campo tem rótulo e unidade, e o foco vai para o título ao trocar de passo.
- [ ] **CA-34** (e2e) Dado um navegador limpo, quando me cadastro, preencho os 3 passos (recarregando a página no passo 2), concluo, chego ao painel, abro as configurações, troco a variante de bruto para "carcaça", salvo, recarrego e depois restauro o padrão, então cada etapa persiste no servidor e o fluxo termina com o selo "padrão da planilha".

- [x] ADR-0011 aprovado pelo humano, com Q1–Q4 respondidas (2026-10-18).

## Textos de ajuda das variantes (CA-28; números gerados pelo domínio)
Exemplo de ouro: 102 ha, 59,77 cab., 188 → 420 kg, R$ 325/@. Os números das variantes não padrão são `origem: "nao-planilha"` e precisam de revisão humana (ADR-0008 §5); conferência à mão abaixo.

**Lotação inicial** (só muda o indicador de lotação; custos e lucro não mudam)
- *Como na planilha: 80 ha fixos* (padrão). "A planilha do curso divide o total de UA por 80 hectares, qualquer que seja o tamanho do seu pasto. Use para bater com a planilha." No exemplo: 24,97 UA ÷ 80 = **0,31 UA/ha**.
- *Pela sua área pastável.* "Divide o total de UA pelos hectares de pasto que você informou. Mostra a lotação real da sua fazenda." No exemplo: 24,97 UA ÷ 102 ha = **0,24 UA/ha**.

**Faturamento bruto** (muda o bruto, o líquido e o total em caixa)
- *Peso vivo, como na planilha* (padrão). "Peso final ÷ 30 kg × cabeças × preço da @. É a conta da planilha do curso." No exemplo: bruto **R$ 271.967,48**, líquido **R$ 102.408,05**.
- *Carcaça.* "Peso final × rendimento de carcaça (52%) ÷ 15 kg × cabeças × preço da @. É mais próximo de como o frigorífico paga, mas não bate com a planilha." No exemplo: bruto **R$ 282.846,18**, líquido **R$ 113.286,75** (R$ 10.878,70 a mais). Conta: 420 × 0,52 ÷ 15 = 14,56 @/cab.; × 59,7731 cab. × 325 = 282.846,18; − 47.024,63 − 122.534,80 = 113.286,75.

## Sequência TDD sugerida

**Etapa 1 (seam HTTP com Postgres real; domínio puro)** — primeiros 5 vermelhos:
1. **RF-011 / CA-01**: a fazenda recém-cadastrada devolve `parametros` e `variantes` iguais ao padrão do domínio e `areaPastavelHa`/`onboardingConcluidoEm` nulos. Força a migração aditiva, os `DEFAULT`s, o DTO estendido e o padrão exportado pelo domínio.
2. **RF-011 / CA-03**: `PATCH` com `version: 1`, nome e área responde 200, `version` 2 e `updatedAt` avançado. Força a rota, o schema estrito e o update condicionado.
3. **RF-076 / CA-04**: segundo `PATCH` com a mesma versão-base responde 409 com `atual`. Força o envelope de conflito.
4. **RF-010 / CA-14**: `PATCH` de A no id de B responde 404 idêntico ao de UUID inexistente e B fica intacta. Força o escopo por tenant na escrita.
5. **RN-021 / CA-08**: `rendCarcaca: "1.01"` e `"0.5234567"` dão 400 com `regra` `faixa` e `casas_decimais` (e `"0.9"` é aceito: sem faixas de negócio). Força a validação técnica decimal e a recusa de arredondamento.

Em seguida: CA-05/06/07/09/10, CA-11 (restaurar), CA-12/13 (concluir), CA-15/16/17, e o domínio CA-18/19/20 (pode rodar em paralelo, é puro).

**Etapa 2 (componentes com repositório falso; depois e2e)**: CA-21 (redirecionamento) → CA-22/23/24 (passos, validação, retomada) → CA-25/26 (passo 3 e percentuais) → CA-27/28/29 (configurações, ajuda, restaurar) → CA-30 (conflito) → CA-31/32/33 (estados, a11y) → CA-34 (e2e). As telas usam uma interface de repositório da Fazenda (ADR-0007 §10), sobre a API agora.

## Fora deste ticket
Município, UF, área total, "o que você faz?", importar planilha/Google Sheets, equipe, excluir conta (aparecem no design sem requisito v1; RF-042/RF-060/RNF-009); fila local e edição offline das configurações (T-14); DELETE de qualquer recurso (a regra de CSRF/versão do DELETE está decidida no ADR-0011 §7 e é implementada no T-06).

## Decisões do humano (2026-10-18)
| # | Pergunta | Decisão |
|---|---|---|
| Q1 | O passo 1 pede também o seu nome? | **Sim, o nome da pessoa** (além de nome da fazenda e área pastável). Guardado em `Usuario.nome` (migração aditiva, nulável), exposto como `donoNome` na Fazenda; o cadastro do T-04 não exige nome. Município, UF, área total e "o que você faz?" continuam fora. |
| Q2 | Faixas aceitas dos parâmetros? | **Revisada: não há faixas de negócio.** O pecuarista digita manualmente. Validação só técnica: decimal válido, finito, não negativo; percentuais (rendimento, imposto, consumo) no máximo 100%; @ de compra, @ de venda e UA estritamente > 0 (divisores); respeitar escala/precisão da coluna (400, nunca arredondar). |
| Q3 | Mudar @/desconto recalcula lotes já lançados? | **Não.** O lote guarda os parâmetros vigentes na época do lançamento (T-06/T-17; só registro, nada implementado aqui). |
| Q4 | Números das variantes no exemplo de ouro | **Aprovados**: lotação 0,24 UA/ha; bruto de carcaça R$ 282.846,18; líquido R$ 113.286,75. |

## Estado da pausa (2026-10-18, etapa 1 em andamento)
Nenhum CA está marcado como provado ainda (nada foi fechado de ponta a ponta pela rota). Sem commit/push.

**Feito**
- Docs: ADR-0011 aprovado e atualizado (Q1 `donoNome` em `Usuario.nome`; Q2 sem faixas de negócio, só validação técnica; Q3 e Q4 registradas); este ticket atualizado (CA-01, 03, 08, 09, 12, 22, 24, 27, tabela de decisões).
- Domínio (CA-18/19/20, verde, 10 testes): `packages/domain/src/configuracao.ts` (`PARAMETROS_FAZENDA_PADRAO`, `CONFIGURACAO_PADRAO`, `traduzirConfiguracao`), teste `configuracao.test.ts`, exportado em `index.ts`. Vermelho observado: módulo inexistente; depois verde. Pendente: rodar `pnpm typecheck` do domínio já passou; falta `test:parity` e lint.
- Banco: `schema.prisma` com `Usuario.nome`, 2 enums e 13 colunas na Fazenda; migração aditiva `packages/db/prisma/migrations/20261018120000_add_fazenda_config/migration.sql` (escrita, AINDA NÃO aplicada nem validada).
- Contratos: `packages/contracts/src/decimal-string.ts` (validação técnica por string, regras `formato`/`faixa`/`casas_decimais`), escrito mas ainda não exportado no `index.ts`, sem teste e sem uso.
- `apps/api/package.json`: adicionado `@bovaro/domain` em devDependencies, mas o `pnpm install --offline` e o `prisma generate` não foram confirmados (um comando em segundo plano foi interrompido pela pausa; `apps/api/node_modules/@bovaro/domain` não existe e `packages/db/src/generated` ainda não tem as colunas novas).

**Falta**
1. Rodar `prisma validate`, `prisma generate`, `pnpm install --offline`, e `migrate deploy` no Postgres de teste.
2. Contratos: estender `fazendaSchema` (donoNome, areaPastavelHa, parametros, variantes, onboardingConcluidoEm), `fazendaPatchSchema` estrito, schema de conflito 409; exportar; testes unitários.
3. API: repositório com `update` condicionado à versão (resultado ok/conflito/não encontrada, transação com `Usuario.nome`), rota `PATCH /fazendas/:id`, DTO estendido, handler de erro expandindo `unrecognized_keys` por campo, CSRF já cobre PATCH (JSON obrigatório; confirmar por teste), harness `patchJson`, ajustar testes do T-04 (`fazenda-repository.test.ts` usa a assinatura antiga de `update`; teste "toda rota autenticada responde 401 sem cookie" precisa enviar Origin/JSON para PATCH), caso de isolamento `PATCH /fazendas/:id` no guardião.
4. Fechar, na ordem, os testes HTTP.
5. Gate final: typecheck, lint, test por pacote, test:parity, build, trace-check; atualizar traceability.

**Próximo vermelho (sequência TDD)**: 1. RF-011 / CA-01 em `apps/api/test/fazenda-config.test.ts`: fazenda recém-cadastrada devolve `parametros`/`variantes` iguais a `CONFIGURACAO_PADRAO` do domínio, `donoNome`, `areaPastavelHa` e `onboardingConcluidoEm` nulos. Depois CA-03, CA-04, CA-14, CA-08.

**Revisão pós-protótipo (ADR-0012, proposta):** o protótipo não tem primeiros passos nem tela de parâmetros (Q-D); desconto de venda passa de kg/cab para % (`descontoVendaPct`, Q-A) e a variante `carcaca` sai da v1 (Q-C). Não continuar a etapa 2 (front) nem alterar migração/contrato/domínio até decisão. Nome e área da fazenda passam a ser editados em Conta (T-18).
