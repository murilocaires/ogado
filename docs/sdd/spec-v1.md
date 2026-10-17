# Spec v1 — O Gado Web (Compra e Venda + Recria)

> Rascunho inicial para ser **refinado** pelo `spec-architect` com `grill-with-docs`. Requisitos completos em `docs/negocio/02-requisitos.md`.

## Problema
O pecuarista calcula compra, venda e recria em planilhas frágeis. Precisa de um lugar confiável, no navegador (depois no celular), com os mesmos cálculos do curso, histórico e sem risco de quebrar fórmulas.

## Solução
Aplicação web multi-fazenda com: (1) Compra e Venda de lotes com 3 modos de peso, (2) simulador de Recria com resultado detalhado e cenários por ano safra, (3) painel. Design em `references/design`. Cálculos em `packages/domain` com paridade comprovada por testes de ouro.

## Histórias de usuário (amostra — expandir no grill)
1. Como pecuarista, quero cadastrar uma compra informando peso total, médio ou animal a animal, para registrar do jeito que pesei.
2. Como pecuarista, quero ver o saldo entre vendas e compras, para saber meu giro.
3. Como pecuarista, quero simular a recria alterando investimento, dias e preços, para decidir se compensa comprar.
4. Como pecuarista, quero salvar e comparar simulações da safra, para escolher o melhor cenário.
5. Como pecuarista, quero que campos calculados não sejam editáveis, para não estragar a conta.
6. Como dono da fazenda, quero que ninguém de fora veja meus dados, para ter confiança.

## Decisões de implementação (propostas — confirmar no grill)
- Monorepo pnpm: `apps/web` (Next.js App Router), `apps/api` (Fastify), `packages/domain`, `packages/contracts` (Zod), `packages/db` (Prisma).
- Front consome a API Fastify; cálculos de tela rodam no cliente com `packages/domain` (mesmo código do servidor, que revalida e persiste).
- Auth: sessão por cookie HttpOnly (a decidir: `@fastify/secure-session`/lucia-like) + login Google OAuth. **Aberto.**
- Decimal: `decimal.js` no domínio; Prisma `Decimal`.
- Seam de teste principal: **funções públicas de `packages/domain`** (paridade) + **rotas HTTP da API** (integração com Postgres real) + **e2e de 2 jornadas** (Playwright).

## Decisões de teste
Bom teste = comportamento externo, nomeado com ID. Seams: domínio, API, e2e. Prior art: `tests/fixtures/golden.json` e `references/calculo/verify.py`.

## Web instalável e offline (v1) — ADR-0007
A versão web é um **PWA instalável** e **offline-first**: instala no desktop/celular, abre sem internet, calcula offline e permite lançar/editar/excluir lotes e cenários, que ficam numa fila local (IndexedDB) e sincronizam ao reconectar. Requisitos: RF-070…RF-080, RNF-012…RNF-017.
- Entidades nascem com `id` UUID do cliente, `version`, `updatedAt`, `deletedAt`; mutações idempotentes (`mutationId`); pull por cursor.
- SW só cacheia shell/estáticos; dados autenticados só no IndexedDB por usuário+fazenda; logout apaga.
- Telas usam interface de repositório (API em T-06/T-07, local-first em T-14).
- Histórias: (7) lançar uma venda no curral sem sinal e vê-la subir depois; (8) instalar o app no celular como se fosse um aplicativo; (9) ser avisado se duas edições conflitarem.

## Fora de escopo (v1)
Cria completa, Metas/Fechamento da Recria, integração Google Sheets, app **nativo** móvel, equipe multiusuário, edição colaborativa em tempo real, push notifications, criptografia do banco local.

## Perguntas em aberto (levar ao grill)
**Resolvidas no grill (2026-10-17):** offline/PWA e conflito = perguntar sempre, login exige internet (ADR-0007); 80 ha e área pastável (ADR-0004); variantes de fórmula escolhidas na fazenda (ADR-0008); bruto padrão = peso vivo; **1 fazenda por conta** (várias = v1.1). Ainda abertas: 3, 4 e 5 abaixo.
1. Mais de uma fazenda por conta? (v1 propõe 1.)
2. Opção "pela área pastável" (PA-01): padrão desligada — confirmar com o pecuarista.
3. Provedor de hospedagem e CI.
4. Estratégia de auth (biblioteca) e envio de e-mail (reset de senha).
5. Direitos de uso do nome/conteúdo "O Pecuário".
