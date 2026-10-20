# ADR-0015 — Cenários completos, versionados e reproduzíveis

**Status:** aceito para correção de integridade autorizada pelo dono em 20/10/2026. Não altera fórmulas nem aprova nova regra de negócio.

RF-032/035/079 e RN-023 exigem conservar entradas, variantes, parâmetros e resultados do cenário. A auditoria identificou contratos que aceitavam mapas incompletos, a omissão de `cabecasInteiras` no resultado e a perda de parâmetros ao abrir no simulador. A alteração local preexistente do produto utiliza cabeças inteiras com arredondamento para cima; essa decisão é preservada.

O contrato compartilhado em `packages/contracts/src/cenarios.ts` valida os 14 campos de entrada, as variantes, os quatro parâmetros e todos os resultados persistidos, incluindo os cinco custos distintos. Os tipos da web derivam desses schemas. Decimais derivados são strings canônicas com sinal opcional, sem arredondamento; valores indefinidos permanecem `null`.

O JSON `variantes` recebe `schemaVersao: 1`, `calculoVersao` e `cabecasInteiras`. Esse local conserva as versões no snapshot já armazenado na API e no aparelho, sem migração de colunas. `recria-1` identifica o legado com cabeças fracionárias; `recria-2` identifica o comportamento atual da interface com cabeças inteiras. A variante explícita continua governando o cálculo. Nenhuma versão troca a fórmula silenciosamente. Ao abrir um cenário, a interface restaura as variantes e os parâmetros capturados.

**Decisão posterior do dono (ADR-0017, 20/10):** a simulação atual recalcula a lotação inicial por hectare pela área informada, inclusive ao abrir legado `fixa80`. O replay financeiro e os demais parâmetros continuam preservados. O snapshot original não é reescrito; um novo salvamento captura a variante `areaPastavel` efetivamente aplicada.

A normalização admite apenas legados completos: ausência das novas propriedades recebe versão 1, cálculo `recria-1` e `cabecasInteiras: false`. Não tenta adivinhar regras de registros parcialmente preenchidos nem recalcula resultados históricos. Versões futuras, campos ausentes e decimais ilegíveis são recusados. Entradas novas passam pelo contrato estrito; respostas de leitura conservam o JSON histórico como desconhecido, com metadados validados, para permitir quarentena individual sem bloquear uma página ou excluir dados. A borda de persistência registra e apresenta os itens inválidos.

Compra e Venda, Recria e o parser usam construtores Decimal isolados com precisão 28 (ADR-0003). A escolha dos melhores cenários percorre a coleção uma vez e preserva empates. A paridade continua verificada no comportamento padrão da planilha; os novos testes distinguem explicitamente esse padrão da variante da interface.
