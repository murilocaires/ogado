# Persistência e sincronização — correções de 20/10/2026

Base: ARQ-01/02/05/06/08 da auditoria de 19/10; critérios 2, 3, 5 e 6 da spec de correções. A implementação mantém a interface do repositório e a política de conflitos já aprovada no código e em `docs/sincronizacao-automatica.md`. Decisões: ADR-0015/0016.

## Implementação

O repositório padrão usa IndexedDB nativo. Entidades e fila são confirmadas na mesma transação; BroadcastChannel propaga alterações entre abas. O motor usa Web Locks para impedir duas rodadas simultâneas da mesma origem. A migração conserva UUIDs, versões, controle de sincronização, identidade e backup do envelope original. A geração do banco invalida gravações de abas antigas depois do logout.

As telas aguardam `flush()` antes de anunciar sucesso ou fechar os diálogos de gravação. Se a cota falhar, apresentam erro e conservam a edição; o retry reutiliza o ID e não duplica o lançamento/cenário. Uma revisão adicional encontrou que a releitura de outra aba podia substituir uma edição cuja gravação falhara. O teste real reproduziu GARROTES em lugar da edição NOVILHAS. A correção mantém as intenções locais pendentes até seu commit; retry mescla também os campos confirmados pela outra aba.

O estado da sessão reage à identidade compartilhada entre abas. Login/cadastro, perfil, logout e exclusão de conta em voo não podem restaurar uma sessão anterior nem limpar os dados de uma sessão mais nova. O provider relê a geração atual após sair, sem executar uma segunda limpeza do banco.

O pull opt-in usa páginas limitadas e cursor `(updatedAt,id)`, inclui tombstones e confirma checkpoint somente depois de entidades/quarentena duráveis. Payload histórico inválido fica isolado com original recuperável; registros válidos continuam. Empates são ordenados pelo ID e o último milissegundo é relido na rodada seguinte. Escritas da API adquirem lock da fazenda e atribuem timestamp lógico maior que os já confirmados, impedindo que relógio retrocedido ou requisição atrasada fique atrás do cursor. Idempotência e versão otimista permanecem. SQL de manutenção fora desses repositórios exige ressincronização completa.

Novas simulações e limpar usam `areaPastavel`; históricos `fixa80` permanecem reproduzíveis. O rascunho da recria continua em memória, conforme política já existente: somente cenários explicitamente salvos são sincronizados.

## Evidências

| Verificação | Resultado | Evidência |
|---|---|---|
| Repositório público, IndexedDB real em Edge: duas abas/recarga; campos concorrentes; cota/atomicidade/retry; migração; logout; edição pendente + alteração de outra aba | **6/6 aprovados** | [navegador](evidencias/persistencia-browser-final.txt) e [execução](evidencias/persistencia-browser-final.json) |
| Edição com cota falha substituída pela outra aba, antes da correção | **Falha reproduzida** | [regressão](evidencias/persistencia-pendente-red.txt) |
| Login/cadastro/perfil/logout/exclusão em voo após mudança de sessão | **5 falhas reproduzidas antes da correção** | [regressão](evidencias/sessao-respostas-antigas-red.txt) |
| Segunda limpeza após logout, antes da correção | **Falha reproduzida** | [regressão](evidencias/sessao-limpeza-red.txt) |
| Controlador de sessão + integração UI/sync após correções | **49 testes aprovados** | [sessão/UI](evidencias/sessao-ui-final.txt) |
| Paginação HTTP com empates, tombstones, isolamento, payload legado inválido e limites | **3/3 aprovados na primeira integração** | [API incremental](evidencias/persistencia-api-incremental.txt) |

Os resultados completos posteriores da API, web e Playwright constam no parecer consolidado desta pasta e prevalecem sobre os focados. Os 49 testes de sessão/UI fazem parte da suíte web; não são somados novamente. O harness de IndexedDB está em `.scratch/correcoes-auditoria-2026-10-20/repo-browser-check.cjs` e testa a interface pública sem Next ou banco simulado. A cota é injetada na operação de outbox do navegador para comprovar aborto da transação real; não representa esgotamento físico do disco.

Não foram testados descarte de armazenamento pelo sistema operacional, iOS real, latência a frio de telefone, carga distribuída ou edição de equipe. Nenhum teste acessou o banco de desenvolvimento ou produção.

## Complemento da retomada: migração, identidade e quarentena

A revisão encontrou que uma indisponibilidade transitória da leitura do localStorage podia ser interpretada como ausência de dados. A migração agora exige a captura completa do legado antes de importar ou marcar sucesso. Usa as mesmas strings capturadas para validar e migrar, preserva os envelopes E1/E2 e o controle original de sincronização, e não sobrescreve um dono já confirmado no IndexedDB. A limpeza só remove um envelope depois do commit, pela instância que o importou, e se o valor ainda for idêntico ao capturado. Se o banco já estiver migrado, sua leitura não depende do localStorage e não executa uma nova limpeza do legado. Uma leitura bloqueada mantém o estado de erro e os originais para a próxima tentativa.

Logout grava um dono nulo explícito no banco, distinguindo a saída confirmada de uma identidade que ainda não foi migrada. As notificações entre abas carregam a origem da janela: o controlador pode reagir a outra aba sem invalidar o próprio logout em andamento. O controle de sincronização relê a geração antes de reutilizar um cache sujo; uma nova geração descarta versões e rejeições da sessão anterior.

Também havia um fluxo sem efeito para cenários remotos inválidos: eles estavam preservados na quarentena, mas não existiam no repositório editável. A lista agora explica essa condição e oferece exclusão real, com a versão original e a identidade da sessão vinculada à requisição. A exclusão confirma o tombstone na API e a remoção durável da atenção antes de anunciar sucesso. Falha de rede ou armazenamento conserva o original e apresenta erro dentro da confirmação. O motor reconhece tombstones mesmo quando o snapshot histórico continua inválido, impedindo que o próximo pull recrie a mesma atenção.

As ações locais dessa lista também aguardam persistência: renomear ou excluir não fecha a confirmação nem mostra sucesso antes de `flush()`. Os diálogos exibem erro acessível e impedem nova confirmação enquanto a operação está em andamento. Uma resposta de exclusão recebida após expiração ou troca da sessão não altera o estado de outra sessão.

| Verificação da retomada | Resultado | Evidência |
|---|---|---|
| Quarentena remota sem exclusão funcional; sucesso antecipado ao renomear/excluir; resposta após expiração | **5 falhas reproduzidas antes da correção** | [RED da UI](evidencias/quarentena-ui-red.txt) |
| Fluxos de atenção e motor: exclusão remota com versão original, confirmação durável, erro sem sucesso falso, sessão expirada e novo pull sem reaparecer | **9 testes selecionados aprovados**; 18 fora do filtro | [GREEN da UI e motor](evidencias/quarentena-ui-green.txt) |
| Seis regressões anteriores do repositório + leitura legada temporariamente bloqueada + cache sujo após nova geração | **8/8 aprovados em IndexedDB real (Edge)** | [execução final do navegador](evidencias/persistencia-browser-retomada-final.txt) |

Os nove testes selecionados pertencem às suítes web e não devem ser somados outra vez ao resultado completo. O oitavo caso do harness verifica o contrato público `gravar()` sem commit, limpeza confirmada do banco e `ready()` da instância antiga: a leitura posterior deve retornar `null`, sem recuperar rejeições ou versões da conta anterior. O sétimo bloqueia temporariamente a leitura do legado e confirma, em outra instância após restaurar o acesso, o mesmo UUID e a versão original. A evidência intermediária [migração bloqueada](evidencias/persistencia-migracao-bloqueada-green.txt) tinha sete casos; a execução final de oito casos a substitui.
