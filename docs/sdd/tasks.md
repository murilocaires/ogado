# Backlog inicial de tickets (tracer bullets) — refinar com `to-tickets`

Formato: `T-nn · título · bloqueado por · requisitos`

| Ticket | Entrega demonstrável | Bloqueado por | Requisitos |
|---|---|---|---|
| T-01 | Monorepo, CI, Docker Compose Postgres, lint/typecheck/test verdes ("hello" end-to-end) | — | RNF-010, RNF-011 |
| T-02 | `domain`: compra e venda com paridade (3 modos de peso) | T-01 | RN-001…006, RN-003, RNF-001 |
| T-03 | `domain`: recria com paridade completa + variantes de fórmula (lotação, bruto — ADR-0008) | T-01 | RN-007…023 |
| T-04 | Auth + fazenda + isolamento multi-tenant (API + tela de login); convenção de entidades sincronizáveis (UUID cliente, version, updatedAt, deletedAt), login por e-mail/senha | T-01 | RF-001 (e-mail), RF-010, RNF-003, RNF-004 |
| T-05 | Onboarding "Primeiros passos" + configurações da fazenda | T-04 | RF-003, RF-011, RN-021, RN-023 |
| T-06 | Compras ponta a ponta, 3 modos de peso (schema → API → tela web) | T-02, T-04 | RF-020, RF-022, RN-003, RN-004 |
| T-07 | Recria: simulador ao vivo + resultado (tela web) | T-03, T-05 | RF-030, RF-031, RF-051, RNF-002 |
| T-08 | Cenários por safra (salvar, duplicar, renomear) | T-07 | RF-032, RN-023 |
| T-09 | Painel | T-08, T-17 | RF-040 |
| T-10 | Estados globais (vazio/erro/confirmação) + a11y + responsivo | T-06, T-07, T-17 | RF-050, RNF-005, RNF-006, RNF-007 |
| T-11 | Exportação CSV/XLSX (nível S) | T-08, T-17 | RF-041 |
| T-12 | Endurecimento: segurança, logs, LGPD mínima, desempenho da API, e2e das 3 jornadas (inclui offline) | T-09, T-10, T-15, T-16 | RNF-002, RNF-003, RNF-008, RNF-009, RNF-014 |
| T-13 | PWA instalável: manifest, ícones, SW (shell offline), botão Instalar (+ instruções iOS); simulador e cálculos funcionam offline | T-07 | RF-070, RF-071, RF-072, RNF-012, RNF-016 |
| T-14 | Dados locais + sincronização: Dexie, outbox, `/sync/push` e `/sync/pull`, idempotência, conflitos, itens rejeitados, sessão expirada | T-06, T-08, T-13, T-17 | RF-073, RF-074, RF-076, RF-079, RF-080, RNF-013, RNF-017 |
| T-15 | UX de sincronização: indicador global, selo pendente, atualização de versão, logout seguro, aviso de cota | T-14, T-10 | RF-075, RF-077, RF-078, RNF-014, RNF-015 |
| T-16 | Entrada com Google + recuperação de senha por link (e-mail) | T-04 | RF-001 (Google), RF-002 |
| T-17 | Vendas (CRUD) + resumo e saldo | T-06 | RF-021, RF-023, RN-002, RN-005, RN-006 |

Arquivos de tickets: `.scratch/web-v1/issues/NN-*.md`, onde NN = número do T-NN.

> **Convenção desde T-04 (ADR-0007):** toda entidade de negócio usa `id` UUID gerado no cliente, `version`, `updatedAt`, `deletedAt`; telas de T-06/T-07 acessam dados por interface de repositório (API agora, local-first em T-14).
