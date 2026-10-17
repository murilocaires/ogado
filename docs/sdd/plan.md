# Plano técnico v1 (rascunho)

## Arquitetura
```
apps/web (Next) ──HTTP/JSON (Zod)──▶ apps/api (Fastify) ──Prisma──▶ PostgreSQL
      └─────────────── packages/domain (puro, Decimal) ───────────────┘
                      packages/contracts (Zod) compartilhado
```
## Offline / PWA (ADR-0007)
```
UI ─▶ repositório (useLotes…) ─▶ Dexie/IndexedDB ─▶ outbox ──(online)──▶ POST /sync/push  ─▶ API ─▶ Postgres
                                       ▲                                  GET  /sync/pull?updatedSince=cursor ──┘
Service Worker: precache shell + estáticos; navegação → fallback shell; NÃO cacheia API autenticada
```
- `packages/contracts`: schemas de `Mutation` (`mutationId`, `entity`, `op`, `baseVersion`, `payload`) e respostas `applied | conflict | rejected`.
- `apps/api`: `/sync/push` (idempotente por `mutationId`, transação por mutação) e `/sync/pull` (cursor por `updatedAt`+`id`, inclui tombstones).
- `apps/web`: `lib/local-db` (Dexie, versão de esquema + migração), `lib/sync` (motor da fila, backoff, `online`/`visibilitychange`), `app/manifest`, SW via Serwist.
- Tabelas de negócio: `id` UUID (cliente), `version`, `updatedAt`, `deletedAt`.

## Camadas e regras
- `domain`: funções puras (`calcCompraVenda`, `calcRecria`), sem dependências de I/O.
- `contracts`: schemas Zod (entrada/saída), `parseDecimalPtBr`.
- `api`: rotas finas → casos de uso → repositórios Prisma; plugins de auth, tenant, erro, log.
- `web`: páginas por feature; componentes primitivos a partir dos tokens do design.

## Modelo de dados (esboço)
Usuario, Fazenda(areaPastavel, parametros JSON), Membro, LoteCompra, LoteVenda, PesoAnimal(loteId, kg), SimulacaoRecria(fazendaId, anoSafra, nome, entradas JSON, resultado JSON opcional).

## Qualidade
CI: install → typecheck → lint → test (domínio+API) → test:parity → build → e2e (nightly). Cobertura domínio ≥ 95%.

## Riscos
Cálculo divergente (mitigado por paridade), vazamento entre tenants (testes), UX de entrada pt-BR (parser único), perda/duplicação na sincronização (idempotência + teste de corte de rede), dados de outro usuário no mesmo aparelho (limpeza no logout), armazenamento descartado em iOS não instalado (orientar instalação).
Seams extras: API `/sync/*` (integração com Postgres) e e2e Playwright em modo offline (`context.setOffline`) + checagem Lighthouse de instalabilidade.
