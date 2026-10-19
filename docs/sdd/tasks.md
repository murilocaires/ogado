# Backlog inicial de tickets (tracer bullets) — refinar com `to-tickets`

Formato: `T-nn · título · bloqueado por · requisitos`

| Ticket | Entrega demonstrável | Bloqueado por | Requisitos |
|---|---|---|---|
| T-01 | Monorepo, CI, Docker Compose Postgres, lint/typecheck/test verdes ("hello" end-to-end) | — | RNF-010, RNF-011 |
| T-02 | `domain`: compra e venda com paridade (3 modos de peso) | T-01 | RN-001…006, RN-003, RNF-001 |
| T-03 | `domain`: recria com paridade completa + variantes de fórmula (lotação, bruto — ADR-0008) | T-01 | RN-007…023 |
| T-04 | Auth + fazenda + isolamento multi-tenant (API + tela de login); convenção de entidades sincronizáveis (UUID cliente, version, updatedAt, deletedAt), login por e-mail/senha | T-01 | RF-001 (e-mail), RF-010, RNF-003, RNF-004 |
| T-05 | Primeiros passos (3 passos, retomáveis) + configurações da fazenda (9 parâmetros, 2 variantes, restaurar padrão, versão otimista 409); redirecionamento pós-login (ADR-0011) | T-04 | RF-003, RF-011, RN-021, RN-023, RNF-007, RF-050 (destas telas), RF-076 (contrato da Fazenda) |
| T-06 | Compras ponta a ponta, 3 modos de peso (schema → API → tela web) | T-02, T-04 | RF-020, RF-022, RN-003, RN-004 |
| T-07 | Recria: simulador ao vivo + resultado (tela web) | T-03, T-05 | RF-030, RF-031, RF-051, RNF-002 |
| T-08 | Cenários por safra (salvar, duplicar, renomear) | T-07 | RF-032, RN-023 |
| T-09 | Painel | T-08, T-17 | RF-040 |
| T-10 | Estados globais (vazio/erro/confirmação) + a11y + responsivo | T-06, T-07, T-17 | RF-050, RNF-005, RNF-006, RNF-007 |
| T-11 | Exportação CSV/XLSX (nível S) — **pronta na web (2026-10-19; falta revisão humana)** | T-08, T-17 | RF-041 |
| T-12 | Endurecimento: segurança, logs, LGPD mínima, desempenho da API, e2e das 3 jornadas (inclui offline) — **parcial: exportação dos dados do titular (RNF-009) pronta; consentimento versionado pronto como rascunho (Termos de Uso e Política de Privacidade em `docs/legal`, páginas `/termos` e `/privacidade`, aceite no cadastro, gate de termos atualizados, envio dos dados por e-mail); falta revisão jurídica e o dono preencher os marcadores do controlador** | T-09, T-10, T-15, T-16 | RNF-002, RNF-003, RNF-008, RNF-009, RNF-014 |
| T-13 | PWA instalável: manifest, ícones, SW (shell offline), botão Instalar (+ instruções iOS); simulador e cálculos funcionam offline | T-07 | RF-070, RF-071, RF-072, RNF-012, RNF-016 |
| T-14 | Dados locais + sincronização: Dexie, outbox, `/sync/push` e `/sync/pull`, idempotência, conflitos, itens rejeitados, sessão expirada | T-06, T-08, T-13, T-17 | RF-073, RF-074, RF-076, RF-079, RF-080, RNF-013, RNF-017 |
| T-15 | UX de sincronização: indicador global, selo pendente, atualização de versão, logout seguro, aviso de cota | T-14, T-10 | RF-075, RF-077, RF-078, RNF-014, RNF-015 |
| T-16 | Entrada com Google + recuperação de senha por link (e-mail) | T-04 | RF-001 (Google), RF-002 |
| T-17 | Vendas (CRUD) + resumo e saldo | T-06 | RF-021, RF-023, RN-002, RN-005, RN-006 |
| T-18 | Conta: perfil, senha, Google (vincular/desvincular), fazenda, sair e apagar conta (ADR-0012) | T-04, T-05 | RF-004, RF-005, RF-006, RF-007, RF-011 |
| T-19 | Cenários: busca, ordenação, lista/grade, abrir no simulador, ★ e comparação de 2–3 cenários (ADR-0012) | T-08 | RF-033, RF-034, RF-035, RF-036 |

**Revisão pós-protótipo (ADR-0012, 2026-10-18; proposta, aguardando aprovação):** T-02 e T-17 passam a RN-024/025 (base da @ e desconto, que o ADR-0013 fixou em 10 kg/cab., não %); T-05 depende de Q-A, Q-C e Q-D (parâmetro `descontoVendaKgCab` conforme ADR-0013, primeiros passos, tela de parâmetros); T-06/T-17 entregam a tela única **Negócios** (RF-024…RF-026); T-07 ganha seletor de lotação na simulação, alertas RN-026 e RF-031 completo; T-08 salva nome livre + data (RF-032); T-09 segue RF-040 revisado; T-10 inclui ajuda contextual RF-052 e navegação RF-053.

Arquivos de tickets: `.scratch/web-v1/issues/NN-*.md`, onde NN = número do T-NN.

> **Convenção desde T-04 (ADR-0007):** toda entidade de negócio usa `id` UUID gerado no cliente, `version`, `updatedAt`, `deletedAt`; telas de T-06/T-07 acessam dados por interface de repositório (API agora, local-first em T-14).

## Plano de entregas incrementais (proposta de 2026-10-18 — substitui a ordem T-01…T-19 acima)
Princípio: **cada entrega termina com uma URL que o cliente abre e usa**. Backend, login e sincronização entram depois, sobre telas que já existem. Domínio (T-02/T-03) e auth (T-04) já estão prontos e são reaproveitados.

| Entrega | O cliente vê | Escopo (tickets) | Fica de fora |
|---|---|---|---|
| **E1 · Produto navegável de verdade** | App publicado (preview) com Painel, Negócios (compras + vendas), Recria, cálculos corretos, dados salvos no navegador | T-06 + T-17 + T-07 em versão **local** (domínio no cliente, sem API, sem login), RF-051/052/053 | login, servidor, cenários |
| **E2 · Cenários** — **pronta (2026-10-18, versão local; aguardando revisão humana)** | Salvar, duplicar, renomear, buscar, comparar 2–3 | T-08 + T-19, alertas RN-026, painel (T-09) | login/API (E3): os cenários ficam no navegador (`lib/repo`, chave `ogado.e2.v2`) |
| **E3 · Conta e dados na nuvem** — **código pronto (2026-10-19; falta deploy Railway/Vercel e e2e com API real)** | Entrar, e os dados seguem o usuário em qualquer aparelho | T-04 (pronto) + T-18 enxuto (perfil, senha, nome/área da fazenda, apagar conta) + API de lotes/cenários | primeiros passos, tela de parâmetros (Q-D), Google |
| **E4 · Instalável e offline** — **código pronto (2026-10-19; falta Lighthouse e teste em iOS real)** | "Instalar app" e uso sem sinal | T-13, parte local do T-14 | conflito entre aparelhos |
| **E5 · Robustez** — **E5-A (sincronização robusta) pronta na web (2026-10-19; falta revisão humana)** | Sincronização entre aparelhos, Google, recuperar senha, exportar | T-14/T-15, T-16, T-11, T-12 | E5-A entregue: indicador e selo, "Sincronizar agora", conflitos (Manter o meu / Usar o do servidor), "Precisa de atenção", nova versão, cota. Fora: IndexedDB/outbox, Google, exportar |

Regras para ganhar velocidade:
- **Uma mini-spec de 1 página por entrega** (requisitos + critérios + o que fica de fora); ADR só para decisão estrutural nova.
- Telas copiadas do protótipo (`docs/prototipo/`), não redesenhadas; testes só nos seams combinados (domínio, 1 e2e por entrega).
- Revisão e demonstração **no fim de cada entrega**, não por ticket.
- Itens adiados viram backlog, não bloqueio: primeiros passos, parâmetros editáveis, variante `carcaca`, conflitos, ano safra.
- **Bloqueio único para a E1:** aprovar o Q-A do ADR-0012 (regra de venda).
