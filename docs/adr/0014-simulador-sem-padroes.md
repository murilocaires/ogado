# ADR-0014 — Simulador da recria sem padrões; atualização silenciosa do app

**Status:** decisão do dono em 2026-10-19 (reversível) · **Data:** 2026-10-19
**Requisitos afetados:** RN-009, RN-021, RF-030, RF-077 · **Relacionados:** ADR-0004, ADR-0007 §9, ADR-0008, ADR-0012 §5

## Contexto
O dono ainda vai estudar a planilha da recria e não quer nenhum número pressuposto pelo app. Os padrões da planilha (102 ha, 270 dias, R$ 122.534,80…) apareciam preenchidos em todo aparelho novo, e a lotação inicial usava 80 ha de referência por padrão. Separadamente, o aviso "Nova versão disponível — Atualizar" pedia uma ação que o pecuarista não precisa tomar.

## Decisão
1. **Simulador começa em branco.** Fazenda/aparelho novo: os 14 campos da recria vazios. O resultado mostra "—" (RN-022). Todos os dados são informados pelo usuário.
2. **Sem "Restaurar padrões".** Removidos o botão, o diálogo e `redefinirRecria('padrao')`; `recriaFormPadrao` deixa de existir na UI. Fica "Limpar campos" (`limparRecria()`).
3. **Sem seletor de lotação inicial.** A lotação inicial é calculada sobre a **área pastável informada** (variante `areaPastavel`) em entradas novas. O campo `lotacaoInicial` do modelo, do contrato e da sincronização continua existindo (compatibilidade e retorno à planilha, se o dono decidir). **Dados já salvos não são migrados**: quem tem `fixa80` salvo mantém o cálculo; a UI só deixa de oferecer a troca. "Limpar campos" volta a variante para `areaPastavel`.
4. **Domínio e paridade não mudam.** `ENTRADA_PADRAO`, `fixa80` e o golden (R$ 102.408,05) seguem no domínio e no `test:parity`. Os testes de UI e e2e preenchem as entradas da planilha com um helper de teste (`planilha.test-support.ts`, `e2e/planilha.ts`) e continuam provando o valor de ouro.
5. **Salvar como cenário com entradas incompletas** segue a regra anterior: não abre o diálogo e orienta a preencher (aviso e dica nos campos). Painel com recria vazia mostra "—" e a orientação "Preencha o simulador da recria…".
6. **Atualização silenciosa (muda ADR-0007 §9 e RF-077).** Sem banner, botão ou toast. O service worker novo chama `skipWaiting()` na instalação e `clients.claim()` na ativação (os caches do build antigo são limpos como antes). A página recarrega sozinha **somente em momento seguro**: sem diálogo aberto e sem campo de texto em foco com conteúdo digitado. Se não for seguro, adia para a próxima navegação entre telas, para o instante em que a aba fica oculta ou para a próxima abertura. Um marcador em `sessionStorage` impede laço de recarregamento. Os dados já ficam no aparelho (localStorage) e a fila de sincronização sobrevive à recarga.

## Consequências
- Quem já usava o app mantém as entradas; só aparelhos/fazendas novos veem o simulador vazio.
- A lotação inicial deixa de ser comparável com a célula `B24` da planilha (80 ha) enquanto o dono não pedir; o domínio continua capaz.
- Reverter: reintroduzir padrões na criação da recria (`recriaInicial`) e o seletor na tela; nada no contrato muda.
