# Sincronizacao automatica

Lotes e cenarios nao pedem uma escolha entre aparelho e servidor. O simulador de recria continua sendo rascunho: somente cenarios explicitamente salvos sincronizam.

## Regra

O aparelho guarda o DTO da ultima versao confirmada em `EstadoSync.bases`. Somente campos que mudaram em relacao a essa base sao enviados sobre a versao atual do servidor. Campos diferentes sao combinados; se o mesmo campo mudou dos dois lados, o ultimo envio aceito pelo servidor prevalece. O relogio do aparelho nao decide o resultado.

Modo, quantidade e pesos formam um grupo para nao produzir uma pesagem incoerente. Base de arroba e desconto tambem formam um grupo. Cenarios sao snapshots imutaveis: apenas nome e exclusao podem mudar.

Uma exclusao sempre prevalece sobre edicoes concorrentes. Nao se cria copia nem se restaura automaticamente um item excluido.

A API continua verificando a versao na escrita. Um 409 provoca nova mesclagem e tentativa, ate cinco vezes por rodada. Se a concorrencia continuar, o trabalho permanece pendente e sera tentado novamente. Edicoes feitas enquanto ha uma requisicao em andamento tambem sao preservadas.

## Historico e recuperacao

Antes de substituir versoes concorrentes, o cliente grava `local`, `servidor` e `resultado` em `HistoricoSync`, no PostgreSQL, com identificador idempotente e isolamento por fazenda. Se esse arquivo falhar, nenhuma substituicao e feita. O arquivo confirma a preservacao dos dados, nao necessariamente o sucesso da escrita seguinte: o campo `resultado` representa a resolucao pretendida. O registro atual deve ser consultado para confirmar o resultado aplicado.

O historico pode ser recuperado pela API autenticada:

- `GET /historico-sync?entidadeId=<uuid>&offset=0`: ate 100 entradas, da mais recente para a mais antiga. Aumentar `offset` em 100 para continuar.
- `GET /historico-sync/<uuid-do-evento>`: recupera uma entrada completa, incluindo valores anteriores.

A recuperacao e uma operacao explicita de suporte: para um item ativo, usar os valores recuperados na edicao normal; para um item excluido, criar um novo registro com os dados recuperados. A sincronizacao nunca revive exclusoes por conta propria. Nao ha janela de escolha de conflito ou tela nova de restauracao nesta alteracao.

Na primeira atualizacao, aparelhos antigos ainda nao possuem uma base de campos. Havendo edicao pendente, a copia local e aceita depois de arquivar as duas versoes. A partir da primeira confirmacao, a comparacao por campo passa a funcionar. Conflitos manuais antigos sao reprocessados pela mesma regra.

## Implantacao

Aplicar a migracao aditiva `20261021130000_add_historico_sync` e publicar a API antes ou junto do frontend. O Dockerfile da API executa `prisma migrate deploy` antes de iniciar. Se o frontend encontrar uma API antiga sem historico, a resolucao permanece pendente, sem descartar dados.

## Validacao

Testes cobrem mesclagem por campo, desempate, exclusoes, migracao sem base, corrida com 409, rede interrompida, idempotencia do arquivo e edicao durante uma requisicao. Os testes de API verificam isolamento e recuperacao do historico; os testes de integracao exigem PostgreSQL.
