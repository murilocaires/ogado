# Ajustes de uso e investigação da sessão — 2026-10-21

## Pedido e critérios

- RF-004/RF-005/RF-011/RF-025: salvar perfil, senha, fazenda e lote em uma ação, sem modal adicional. Validações de campos e senha repetida permanecem. Confirmações continuam para exclusão, remoção do vínculo Google e saída que apaga os dados do aparelho. Diálogos para informar nome/formato não são confirmações redundantes.
- RF-075: remover o selo “pendente” dos itens. A fila de sincronização continua automática e durável; falhas que realmente exigem intervenção permanecem visíveis.
- RF-032: depois de confirmar a gravação do cenário, limpar e persistir o simulador. Falha na primeira gravação preserva o formulário; repetir a tentativa reaproveita o cenário já criado, sem duplicação.
- RF-033: comparação acompanha a seleção; remover “Atualizar comparação”.
- RF-001/RF-002: não perder autenticação por concorrência nem por iniciar OAuth em origem diferente do callback.

Essas decisões do usuário substituem as confirmações extras descritas anteriormente para RF-004, RF-011 e RF-025.

## Tempo da sessão — somente investigação

Na consulta somente de leitura ao Railway, `SESSION_IDLE_DAYS` e `SESSION_MAX_DAYS` não estavam definidos. Aplicam-se os padrões de `apps/api/src/env.ts`/`config.ts`:

- 30 dias de inatividade, contados a partir de `ultimaVerificacaoEm`.
- Teto absoluto de 90 dias a partir da criação da sessão, mesmo com uso contínuo.
- A atividade autenticada renova o registro e o cookie quando passou mais de uma hora desde a última gravação. O cookie dura no máximo 30 dias e nunca ultrapassa o teto absoluto. Apenas manter uma página aberta sem chamadas autenticadas não renova a sessão.
- O fluxo de login Google tem outro cookie, de 10 minutos. Não é a duração da sessão do produto.

Revogação/invalidade no servidor:

1. Logout apaga somente a sessão correspondente ao token válido.
2. Troca/definição de senha apaga as outras sessões; mantém a sessão atual quando seu identificador está disponível.
3. Redefinição de senha pelo link apaga todas as sessões.
4. Exclusão da conta remove suas sessões pelo relacionamento em cascata.
5. Ao validar um token vencido por inatividade ou teto absoluto, a linha é apagada.
6. Token malformado, segredo inválido, sessão ausente, fazenda ausente/excluída ou identidade diferente da requisição são recusados. Recusa não significa necessariamente revogação; requisição vinculada a outra identidade não apaga a sessão válida.

Um novo login não revoga automaticamente as demais sessões. Desvincular Google não revoga a sessão atual. Perda de cookie por troca de domínio ou limpeza do navegador também impede autenticar, mesmo sem revogação no banco.

O frontend, ao receber 401 com identidade local, leva à tela de entrar. Até 2026-10-21 essa tela apresentava o aviso persistente “Sua sessão terminou…”, removido em 2026-10-22: a expiração agora mostra o login direto, sem mensagem adicional. O aviso nunca provou que os 30/90 dias decorreram e não era o toast de 2,8 segundos. Falha de rede é tratada separadamente. Nenhum prazo ou texto de expiração foi alterado.

## Entrada em duas tentativas

Evidência de produção: os logs filtrados do Railway registraram `motivo=sem_fluxo` nas falhas do Google. A configuração consultada tinha `WEB_ORIGIN=https://ogado.vercel.app`. O código anterior criava cookie na origem inicial e enviava o callback sempre para `WEB_ORIGIN`. Quando o acesso começa por outro domínio/alias, o callback não recebe esse cookie; a segunda tentativa, já na origem de destino, pode funcionar. Não foram consultados tokens, códigos OAuth ou valores de credenciais.

Correção: o link informa a origem de navegação; o servidor redireciona primeiro para a origem canônica configurada e só então cria state/nonce/PKCE e cookie. O destino nunca é controlado pelo parâmetro enviado pelo navegador. Não relaxa validações OAuth nem permissões de CORS/CSRF.

No cliente, `verify()` incrementava a mesma geração usada pelo login. Uma reconexão/verificação durante login/cadastro descartava uma resposta válida. Agora verificação automática não cancela autenticação explícita em andamento. Logout, troca de conta e invalidação real continuam cancelando respostas antigas.

Limites: as mudanças são de código; nenhuma variável/domínio/deploy de produção foi alterado. A origem oficial desejada, `WEB_ORIGIN`, a origem do frontend e o callback cadastrado no Google precisam permanecer alinhados na liberação. A configuração atual ainda aponta para o domínio antigo. Não foi feito login real com conta Google do usuário.

## Validação

Passaram 184 testes das telas/controlador de sessão e 25 testes unitários da API, além de typecheck, lint, build da API/frontend e rastreabilidade estrita. Os testes OAuth usam cliente falso e verificam redirecionamento, ausência de cookie antes de chegar à origem canônica e preservação de state/PKCE. Os testes de cenário cobrem falha na gravação, repetição sem duplicação, limpeza e atualização automática da comparação. Não foram executadas as jornadas integradas com Postgres nem um login real no Google.
