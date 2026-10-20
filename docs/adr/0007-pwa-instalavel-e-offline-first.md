# ADR-0007 — Web instalável (PWA) e offline-first na v1

**Status:** aceito (decisões de conflito, exclusão e login confirmadas pelo pecuarista no grill de 2026-10-17) · **Data:** 2026-10-17

## Contexto
O pecuarista lança pesagens e vendas no curral, onde o sinal falha. O design (`WebEstados`, `AppOffline`) já prevê "Pode continuar lançando… sobe quando a conexão voltar" e "N lançamentos pendentes". Até aqui a spec tratava offline como v3 (app móvel). Decisão: a **versão web v1 é instalável e funciona offline**; o app nativo/móvel continua v3.

## Decisão
1. **PWA instalável**: `manifest.webmanifest` (pt-BR, `display: standalone`, ícones 192/512/maskable, cores dos tokens), service worker, HTTPS obrigatório. Chrome/Edge (desktop e Android): instalação nativa com botão "Instalar o app". iOS/Safari ≥ 16.4: instruções "Adicionar à Tela de Início". Demais navegadores: funcionam sem instalar.
2. **Local-first**: a UI lê e grava num **banco local IndexedDB**; mudanças entram numa **fila de saída (outbox)** e sobem para a API quando há conexão. A API continua sendo a fonte de verdade entre aparelhos. A correção de 20/10 usa a API nativa do navegador, com transações e migração, em vez da biblioteca Dexie inicialmente proposta (ADR-0016).
3. **Service worker (Serwist, a confirmar no plano)**: faz *precache* do shell e dos estáticos; navegação com fallback para o shell em cache. **Nunca** cacheia respostas autenticadas da API — dados vivem só no IndexedDB, escopados por usuário + fazenda.
4. **Cálculo offline sem esforço extra**: `packages/domain` já roda no cliente (mesmo código do servidor). O servidor revalida ao sincronizar.
5. **Contrato de sincronização (vale desde T-04, para não haver retrabalho)**: toda entidade de negócio tem `id` UUID **gerado no cliente**, `version` (inteiro, incrementado pelo servidor), `updatedAt`, `deletedAt` (exclusão lógica/tombstone) e `fazendaId`. Mutações carregam `mutationId` e são **idempotentes** (reenviar não duplica). Pull incremental por cursor (`updatedSince`).
6. **Conflitos (atualizado pela decisão já implementada em `d36a844`)**: v1 tem 1 usuário/fazenda, mas pode haver 2 aparelhos. O servidor recusa versão desatualizada com 409. O motor mescla campos sobre a base confirmada, arquiva as versões concorrentes antes da substituição e tenta novamente. Exclusão prevalece; no mesmo campo prevalece o último envio aceito pelo servidor. Sem arquivo confirmado, mantém pendente. A escolha manual originalmente prevista foi substituída pela política de [sincronização automática](../sincronizacao-automatica.md), que rege RF-076. O relógio do aparelho não decide conflitos.
7. **Autenticação**: login, cadastro, Google OAuth e recuperação de senha exigem internet. Com sessão já aberta, o app funciona offline. Se a sessão expirar offline, o app continua local; ao reconectar pede novo login **sem perder a fila**.
8. **Dados no aparelho**: sem senha/token em IndexedDB/localStorage; sessão só em cookie HttpOnly. Logout (e troca de usuário) apaga o banco local — se houver pendências, avisa antes ("N lançamentos ainda não foram enviados"). Pedir `navigator.storage.persist()`.
9. **Atualizações** (substituído pelo ADR-0014: atualização silenciosa, sem aviso nem botão): nova versão do SW baixa em segundo plano e mostra "Nova versão disponível — Atualizar"; nunca recarrega no meio de uma edição. Esquema do IndexedDB tem versão e migração; a API aceita payloads de contratos antigos na fila (contratos versionados).
10. **Seam de dados no front**: telas consomem uma interface de repositório (`useLotes`, `useCenarios`…). Em T-06/T-07 ela é implementada sobre a API; em T-14 troca para local-first sem mexer nas telas.

## Fora do v1 (continua)
Edição simultânea em tempo real, sincronização em segundo plano com o app fechado (Background Sync é best-effort, não requisito), criptografia do banco local, push notifications, app nativo.

## Consequências
- Custo: +3 tickets (T-13, T-14, T-15) e +1 seam de teste (API de sync + e2e offline).
- Risco: perda/duplicação na sincronização → mitigado por idempotência, tombstones e teste de corte de rede (RNF-017).
- Risco: iOS pode descartar armazenamento de sites não instalados → orientar a instalar; avisar pendências antigas.
- Alternativas rejeitadas: só *cache* do shell sem escrita offline (não atende o curral); dados offline cacheados pelo SW (vazamento entre usuários, difícil de invalidar); PouchDB/CouchDB (outra infra, foge da stack).
