# Bovaro — instruções para agentes

Produto: gestão de pecuária (cria/recria/compra e venda) a partir das planilhas do curso **O Pecuário**. v1 = web (Compra e Venda + Recria) com **paridade exata** de cálculo. Stack: Next.js, TypeScript, Fastify, Prisma, PostgreSQL, Zod, Node. Idioma: pt-BR (UI, docs); código em inglês técnico.

## Leia primeiro
1. `docs/sdd/constitution.md` — regras inegociáveis.
2. `GLOSSARY.md` — vocabulário.
3. `docs/negocio/01-negocio.md`, `02-requisitos.md`, `03-formulas-e-paridade.md`.
4. `references/design/README.md` — telas e tokens.
5. `docs/adr/0012-revisao-pos-prototipo.md` — decisões baseadas no protótipo legado do pecuarista; onde diverge do design, vale o protótipo.

## Como trabalhamos (SDD + loops)
Use `/sdd-workflow`. Fases: especificar → planejar → implementar em loop (TDD, máx. 5 iterações) → revisar → entregar. **Sem requisito numerado, sem código.** Decisões estruturais viram ADR em `docs/adr/`.

## Custo
Escolha o modelo pela tarefa: `.claude/config/model-routing.json` (`node scripts/route-model.mjs <tarefa>`). Comece barato, escale só por gate falho, `frontier` só com aprovação. Compacte o contexto aos 60% e use o subagente `explorer` para leituras grandes.

## Comandos (após o ticket T-01)
`pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm test:parity` · `pnpm dev` · `node scripts/trace-check.mjs` · `node scripts/validate-routing.mjs`

## Regras rápidas
- `references/` é somente leitura (hook bloqueia edição).
- Decimal em dinheiro/peso; arredondar só na exibição.
- Toda query com `fazendaId`; Zod nas bordas; sem `any`.
- Campo branco = entrada; menta + cadeado = calculado.
- Git segue `docs/BRANCHING.md`: branches temporárias partem de `develop`, PRs de trabalho têm base `develop` e releases têm base `main`. Hotfixes partem de `main` e voltam também para `develop`. Commit, push e PR dependem do escopo autorizado; todo merge exige aprovação explícita do humano. Esta regra substitui a autorização geral de merge de 2026-10-18. Nunca force push, `reset --hard`, `clean -f` ou exclusão de trabalho não integrado.
- Pergunte ao humano quando for regra de negócio; não invente fórmula.
- Mudou tratamento de dados pessoais (novo dado, provedor, cookie/armazenamento, retenção, finalidade)? Atualize `docs/legal/*`, suba `TERMOS_VERSAO` (e o manifesto de hash) em `packages/contracts/src/termos.ts` e cite no PR. O teste de hash falha se esquecer.

## Agent skills
### Issue tracker
Markdown local em `.scratch/<feature>/`. Ver `docs/agents/issue-tracker.md`.
### Domain docs
Single-context: `GLOSSARY.md` + `docs/adr/`. Ver `docs/agents/domain.md`.
