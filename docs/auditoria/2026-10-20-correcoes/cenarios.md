# Correções de cenários, precisão e seleção do melhor

Data: 20/10/2026. Escopo: ARQ-02/03/04/05; RF-030/032/035/036/074/079, RN-023 e RNF-001/017. A base é a spec autorizada em `.scratch/correcoes-auditoria-2026-10-20/spec.md` e o ADR-0015. As alterações locais anteriores de cabeças inteiras foram preservadas.

O contrato de cenário agora descreve entradas, variantes, parâmetros, resultado e os cinco custos distintos. Os tipos da web derivam dos schemas Zod compartilhados. A escrita rejeita objetos incompletos, valores numéricos JSON, decimais ilegíveis e versões desconhecidas. A leitura conserva o JSON histórico com metadados validados para que o motor de sincronização coloque cada registro inválido em quarentena sem bloquear os demais. A persistência e a apresentação da quarentena são verificadas na frente de persistência.

Cada snapshot registra `schemaVersao`, `calculoVersao` e `cabecasInteiras` em `variantes`. Legados completos são normalizados para `recria-1` e cabeças fracionárias; novos cenários da interface conservam `recria-2` e o arredondamento para cima existente. Abrir no simulador restaura parâmetros e variantes. O teste de replay verifica os literais independentes R$ 102.408,05 para o padrão da planilha e R$ 103.307,60 para a variante atual da interface.

Compra e Venda, o parser pt-BR e o Decimal exportado usam construtores isolados com precisão 28. Mudar a precisão da biblioteca por um consumidor externo deixa de alterar os cálculos. A Recria já usava um construtor isolado. As estrelas da lista/grade são calculadas em uma passagem, com um `Set` reutilizado pelo render e preservação de empates: tempo O(N), memória O(N) no pior caso de empate. A ordenação por nome/data/líquido mantém sua operação separada O(N log N).

As ações de abrir, duplicar, renomear e excluir aguardam a confirmação da gravação no aparelho antes de anunciar sucesso. Se houver falha, a tela apresenta o motivo e mantém o diálogo de edição/exclusão aberto. Repetir uma duplicação cujo armazenamento falhou tenta gravar a cópia já criada em memória, preservando seu identificador. Cliques concorrentes na mesma duplicação são bloqueados enquanto a gravação está pendente.

| Verificação executada | Resultado | Evidência |
|---|---|---|
| RED de contrato incompleto | 1 falha esperada | `evidencias/cenarios-red-contratos.txt` |
| RED de interferência de precisão global | 2 falhas esperadas | `evidencias/cenarios-red-precision.txt` |
| RED de snapshot/replay/melhores | 3 falhas esperadas | `evidencias/cenarios-red-replay.txt` |
| RED de falha de gravação/repetição de cópia | 1 falha esperada | `evidencias/cenarios-red-gravacao.txt` |
| Contratos e paginação | 10 aprovados | `evidencias/cenarios-green-contratos.txt` |
| Domínio: precisão, Compra e Venda, Recria e parser | 115 aprovados | `evidencias/cenarios-green-dominio.txt` |
| Snapshot/replay/melhores e tela de cenários, incluindo falha de gravação e retry | 21 aprovados | `evidencias/cenarios-green-web.txt` |
| Abrir cenário legado pela tela com parâmetros próprios | 1 aprovado; 16 não selecionados | `evidencias/cenarios-green-ui-legado.txt` |
| Paridade com planilhas | 181 verificações aprovadas, tolerância relativa 1e-6 | `evidencias/cenarios-paridade.txt` |
| Typecheck de contratos e domínio | Aprovado | `evidencias/cenarios-typecheck-contratos.txt`, `evidencias/cenarios-typecheck-dominio.txt` |
| Lint dos arquivos alterados | Aprovado | `evidencias/cenarios-lint.txt`, `evidencias/cenarios-lint-final.txt` |

Os testes usaram um worker e memória local para cálculo/UI. Nenhum banco real foi necessário nesta frente. O teste da tela com legado foi escrito após a correção coordenada do repositório e passou diretamente; os RED anteriores comprovam as regressões de contrato, precisão e replay do domínio. A validação final do monorepo, PostgreSQL, cursor durável e múltiplas abas pertence à integração das frentes e deve prevalecer sobre estes resultados parciais.

A revisão final dos contratos confirmou correspondência entre os 16 campos derivados persistidos e o resultado da interface, validação dos cinco custos e ausência de coerção para `number`. A leitura permissiva se limita ao payload histórico: a escrita permanece estrita e nenhum JSON desconhecido entra no cálculo sem normalização. A revisão do render confirmou que `ehMelhor` não é mais chamado por item; os destaques consultam apenas `melhores.has(id)` após uma seleção memoizada.
