# Fluxo de branches do Bovaro

## Branches e destinos

| Branch | Função | Origem | Destino do PR |
| --- | --- | --- | --- |
| `main` | Versão estável; produção | promoção validada | — |
| `develop` | Integração e validação | `main` na criação inicial | `main` para release |
| `feature/*` | Funcionalidades | `develop` | `develop` |
| `fix/*` | Correções comuns | `develop` | `develop` |
| `refactor/*` | Refatorações | `develop` | `develop` |
| `hotfix/*` | Correções urgentes de produção | `main` | `main`, depois sincronizar `develop` |

Somente `main` e `develop` são permanentes. Branches antigas `feat/*`, `chore/*`, `docs/*`, `test/*` e `worktree-agent-*` são legadas e temporárias: não renomear nem apagar automaticamente trabalho existente. Para novas funcionalidades, usar `feature/*`.

## Criar uma feature e abrir PR

Primeiro execute `git status --short` e `git worktree list`. Se houver trabalho local, preserve-o e use outro worktree; não faça stash, reset ou checkout destrutivo automaticamente.

```bash
git fetch origin
# Em um checkout limpo:
git switch -c feature/nome-da-entrega origin/develop
# Alternativa com trabalho pendente no checkout atual:
# git worktree add ../bovaro-nome-da-entrega -b feature/nome-da-entrega origin/develop

# Implemente, valide e adicione apenas os arquivos da entrega.
git add caminho/do/arquivo
git commit -m "feat: descreve a entrega"
git push -u origin feature/nome-da-entrega
gh pr create --base develop --head feature/nome-da-entrega
```

Se `gh` não estiver instalado/autenticado, use a interface do GitHub e selecione explicitamente `base: develop`. Descreva problema, comportamento resultante, validações e riscos. Documentação e testes acompanham o código; arquivos `.test.ts`, `.spec.ts` e equivalentes permanecem versionados inclusive na `main`.

## Validação, merge e limpeza

- Faça revisão e aguarde todos os checks aplicáveis: `ci` e `browser` no workflow atual.
- O pipeline já executa lint, typecheck, testes, cobertura, paridade, desempenho, rastreabilidade, build, auditoria e E2E com Postgres isolado.
- CI verde é necessária, mas não substitui aprovação explícita do humano para qualquer merge, inclusive entre branches de agentes. Não habilitar auto-merge por conta própria.
- Depois do merge aprovado, o GitHub pode excluir a branch temporária. `main` e `develop` têm regra ativa contra exclusão, inclusive automática.
- Antes de excluir branch/worktree local, confira PR integrado, commits adicionais, alterações locais e uso por outros agentes. Use `git branch -d` somente quando seguro; nunca `-D`. Squash pode não ser reconhecido por ancestralidade: revise o PR e o conteúdo, sem forçar exclusão.
- Não fazer force push, reescrever histórico, descartar alterações ou juntar trabalho pendente automaticamente.

## Liberar uma versão

1. Integre as entregas aprovadas em `develop` e valide CI e homologação isolada.
2. Abra PR de `develop` para `main`: `gh pr create --base main --head develop`.
3. Revise o conjunto, compatibilidade, migrações e plano de retorno. Solicite aprovação explícita para merge e impacto em produção: `main` está ligada aos deploys.
4. Após aprovação, prefira **merge commit** na promoção, preservando a ancestralidade entre as branches permanentes. Nunca exclua `develop`.
5. Acompanhe os deploys e a saúde do serviço. Não execute deploy manual sem autorização.

## Hotfix

Crie `hotfix/nome` de `origin/main`, valide e abra PR para `main`. Após merge aprovado, abra PR de `main` para `develop` para incorporar a correção e manter a ancestralidade. Esse segundo merge também precisa de CI e aprovação. A regra contra exclusão mantém `main` segura mesmo quando ela é a origem do PR. Não faça cherry-pick ou merge automático.

## Deploy e isolamento

| Destino | Situação verificada em 2026-10-21 | Política |
| --- | --- | --- |
| Vercel Production | Projeto `bovaro`, raiz `apps/web`, branch `main`, commit `e3186a0` pronto | Apenas versão aprovada |
| Railway | Projeto `ogado`, único ambiente `production`, serviços `api` e `Postgres`; API em `main`, commit `e3186a0`, sucesso | Não reutilizar banco de produção em testes |
| `develop` | Branch publicada; sem ambiente Railway de homologação | Homologação só após isolamento verificado |
| Branches temporárias | Integração Git da Vercel suporta Preview | Preview não comprova isolamento do backend |

A Vercel tem `API_ORIGIN` e `PROXY_SECRET` nos escopos Production e Preview, sem override específico de branch identificado. Valores não foram expostos nem alterados; não foi comprovado se Preview aponta para uma API isolada. Não executar testes que escrevem dados em Preview até confirmar isolamento. A publicação de branches pode disparar Preview automaticamente pela integração existente.

O Dockerfile da API executa `prisma migrate deploy` ao iniciar. Criar homologação exige API e banco separados, referências de ambiente revisadas e aprovação prévia se gerar custo. Não copiar credenciais de produção nem executar migração/limpeza de teste no Postgres de produção. Nenhum ambiente, domínio ou variável foi alterado nesta configuração.

A CI usa Postgres efêmero em `localhost`, com bancos `ogado_test` e `ogado_browser_test`, sem segredos de produção. `packages/db/src/test-database.ts` exige `TEST_DATABASE_URL`, host local/CI e nome de banco de teste antes de migrações/limpeza. Não contorne essa validação. Testes remotos permanecem pendentes até a confirmação do isolamento.

Na inspeção, Vercel usava `pnpm --filter @ogado/web build` e Node 24.x; o rebrand usa `@bovaro/web`, enquanto CI/Docker usam Node 22. A continuação do rebrand adiciona `apps/web/vercel.json` com o comando do novo pacote para deployments desse código. O painel de produção não foi alterado. Ver `docs/engenharia/rebrand-bovaro.md`; a promoção para produção continua exigindo aprovação.

## GitHub: aplicado e proposta pendente

- Repositório `murilocaires/ogado`, público; `main` mantida como padrão.
- `develop` criada de `origin/main` em `e3186a0308b5411d0aa76e526e0fdfbdfd3cb6c1`, publicada e rastreando `origin/develop`. A `main` local permanece em `f99e4c0` (um commit atrás); não foi movida.
- Exclusão automática após merge: habilitada e relida pela API.
- Ruleset `permanent-branches-no-deletion`, ID `25553470`: ativo para `main` e `develop`, sem bypass, somente restrição de exclusão. Não exige PR ou CI nem impede pushes comuns.
- Nenhum PR aberto na inspeção. `gh` ausente; consultas e configurações usaram a API do GitHub com a autenticação Git existente, sem gravar credenciais.
- Antes desta tarefa não havia proteção clássica em `main` nem rulesets. **Exigência de PR/CI ainda não aplicada**, pois pode bloquear o fluxo existente e depende da aprovação solicitada pelo usuário.

Proposta concreta para as duas branches: exigir PR, conversas resolvidas e checks `ci` e `browser`, impedir force push e preservar a restrição de exclusão. Não exigir aprovação de outro revisor por padrão (repositório individual); a aprovação humana para execução pelo agente continua obrigatória. Não exigir histórico linear, para permitir merge commits de releases/hotfixes. Ativar checks obrigatórios apenas após confirmar execuções válidas no código alvo.

Procedimento manual após aprovação: Settings → Rules → Rulesets → New branch ruleset, selecionar `main` e `develop`, ativar Require a pull request before merging, Require conversation resolution, Require status checks (`ci`, `browser`) e Block force pushes. Manter a regra existente contra exclusão. Se o plano/permissões não disponibilizarem esses controles, registrar a limitação e aplicar revisão manual; não trocar a branch padrão. A exclusão automática fica em Settings → General → Pull Requests → Automatically delete head branches.

## Agentes e skills

`CLAUDE.md` remete a este documento e revoga a antiga autorização genérica de merge. `sdd-workflow`, `implement` e `implement-spec` usam o mesmo fluxo; a implementação por worktrees deve preservar trabalho, sem reset automático. O hook local `.claude/hooks/block-dangerous-git.sh` continua bloqueando inclusive pushes no Claude Code; não foi removido ou enfraquecido. `PROMPT_INICIAL.md` também mantém sua restrição de push para aquele fluxo. Autorização explícita do usuário define o escopo de cada sessão; bloqueios da ferramenta devem ser reportados, não contornados por agentes.

## Inspeção e limites desta entrega

A sessão começou em `feat/bovaro-rebrand`, com 212 entradas modificadas, 287 removidas e 4 entradas não rastreadas (diretórios agrupados por `git status --short`). Todas foram preservadas. Não houve checkout, commit, merge, exclusão de branches ou deploy de produção nesta tarefa.

O ajuste inicial da CI inclui `develop` no gatilho de push; `pull_request` já cobria todos os destinos. A continuação autorizada do rebrand inclui também o teste isolado de migração IndexedDB e publica os arquivos na branch de trabalho. A CI remota de `develop` continua igual à `main` de origem até um PR aprovado integrar o ajuste. Não integrar automaticamente o rebrand.

Fontes: [exclusão automática no GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches), [regras disponíveis](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), [integração Git da Vercel](https://vercel.com/docs/git/vercel-for-github).

## Inventário de branches após a configuração

Nenhuma branch legada foi excluída. A coluna de ancestralidade compara somente commits com `origin/main`; não comprova ausência de trabalho local e pode indicar não após squash.

| Branch local | Também no remoto | Ancestral de `origin/main` |
| --- | --- | --- |
| `chore/backup-e-monitoramento` | sim | sim |
| `develop` | sim | sim |
| `docs/fora-de-escopo-parametros` | sim | sim |
| `feat/acessibilidade` | não | não; revisar |
| `feat/bovaro-rebrand` | não | não; revisar |
| `feat/e1-produto-navegavel` | sim | sim |
| `feat/e2-cenarios` | sim | sim |
| `feat/e3-nuvem` | sim | sim |
| `feat/e4-instalavel-offline` | sim | sim |
| `feat/e5-sync-robusta` | sim | sim |
| `feat/exportacao` | sim | sim |
| `feat/google-auth` | sim | sim |
| `feat/recria-cards-da-planilha` | sim | sim |
| `feat/recuperar-senha` | sim | sim |
| `feat/sugerir-instalar-app` | sim | sim |
| `feat/termos-e-consentimento` | sim | sim |
| `fix/ajuda-lotacao-inicial` | sim | sim |
| `fix/ajustes-visuais-negocios` | sim | sim |
| `fix/barra-rolagem-modal` | sim | sim |
| `fix/cabecas-arredondar-para-cima` | sim | sim |
| `fix/cadastro-google-primeiro` | sim | sim |
| `fix/desconto-venda-kg-por-cabeca` | sim | sim |
| `fix/indicador-sync-discreto` | sim | sim |
| `fix/ip-real-do-cliente` | sim | sim |
| `fix/link-esqueci-senha` | sim | sim |
| `fix/lotacao-inicial-padrao-planilha` | sim | sim |
| `fix/mobile-tap-highlight` | sim | sim |
| `fix/modal-scroll-interno` | sim | sim |
| `fix/modal-venda-desconto-mobile` | sim | sim |
| `fix/modo-peso-campos-independentes` | sim | sim |
| `fix/recria-remove-cards-duplicados` | sim | sim |
| `fix/recria-sempre-centavos` | sim | sim |
| `fix/rotas-protegidas` | sim | sim |
| `fix/rotulos-da-planilha` | sim | sim |
| `fix/simulador-zerado-update-silencioso` | sim | sim |
| `fix/sync-pagination-api-compat` | sim | não; revisar |
| `main` | sim | sim |
| `test/e3-e2e-sync` | sim | sim |
| `worktree-agent-a03f2597e43d8945b` | não | sim |
| `worktree-agent-a2281abe37e288f51` | não | sim |
| `worktree-agent-a6783b889588a9928` | não | sim |
| `worktree-agent-a722978a1d0450a66` | não | sim |
| `worktree-agent-a7e05749f550c6a45` | não | sim |
| `worktree-agent-a883b68ad9b0cbeec` | não | sim |
| `worktree-agent-a9909752297ae8597` | não | sim |
| `worktree-agent-ab1090c1421f48faf` | não | sim |
