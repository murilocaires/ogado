# Rebrand para Bovaro

O nome público, metadados, manifesto PWA, mensagens, exportações e pacotes do workspace passam a usar Bovaro / `@bovaro/*`. Os termos e a política de privacidade têm versão `2026-10-21`, com manifesto SHA-256 atualizado e novo aceite pelo fluxo existente.

## Compatibilidade

- Cookies antigos de sessão e OAuth continuam sendo aceitos durante a transição; logout limpa os nomes antigos e novos.
- A API aceita cabeçalhos antigos e novos. Publicar a API compatível antes do frontend, somente após aprovação de release.
- Dados de `ogado.local.v1` são copiados atomicamente para `bovaro.local.v1`, incluindo identidade, entidades e fila pendente. O banco original é preservado. Destino já ocupado sem marcador de migração falha fechado para impedir mistura de dados. Logout mantém o marcador para não reimportar dados antigos.
- localStorage antigo continua legível. Identificadores técnicos de banco, volumes, backups e preferências antigas são mantidos quando renomeá-los quebraria compatibilidade.
- A cópia de armazenamento só funciona na mesma origem. Uma troca de domínio não transfere IndexedDB, localStorage ou cookies: sincronizar dados pendentes na origem antiga antes da transição. Não redirecionar clientes com dados offline sem plano de recuperação.

## Deploy

`apps/web/vercel.json` versiona o comando `pnpm --filter @bovaro/web build` no diretório raiz do projeto Vercel (`apps/web`). Assim, branches com o rebrand usam o novo pacote sem alterar o comando das versões antigas. A configuração versionada [sobrescreve o Build Command por deployment](https://vercel.com/docs/project-configuration/vercel-json).

Nenhuma variável, domínio, banco ou configuração remota de produção é alterada por esta entrega. O projeto Railway continua chamado `ogado`. A liberação para produção exige PR e aprovação conforme `docs/BRANCHING.md`. Preview não deve executar testes com escrita até que o isolamento da API seja confirmado.

## Validação

`pnpm --filter @bovaro/web test:e2e:rebrand` verifica a migração em IndexedDB real, origem preservada, logout sem ressurreição, instalação nova e rejeição de bases conflitantes, sem API ou Postgres. Use `E2E_CHANNEL=msedge` no Windows se o Chromium do Playwright não estiver instalado. Esse teste também integra a CI.

As exclusões locais de referências e evidências preexistentes não fazem parte do rebrand e não devem entrar no commit.
