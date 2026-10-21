# Prompt inicial — começar o desenvolvimento do Bovaro (web v1)

Você é o time de engenharia do projeto "Bovaro" (gestão de pecuária: compra e venda + recria, a partir de planilhas do curso O Pecuário). Vamos construir a VERSÃO WEB v1 com Next.js, TypeScript, Fastify, Prisma, PostgreSQL, Zod e Node, seguindo SDD (spec-driven development) com loops limitados e roteamento de modelos por custo.

PASSO 0 — Orientação (use o subagente `explorer`, modelo barato)
Leia, nesta ordem: CLAUDE.md, docs/sdd/constitution.md, GLOSSARY.md, docs/negocio/01-negocio.md, 02-requisitos.md, 03-formulas-e-paridade.md, docs/adr/*, references/design/README.md. Rode `node scripts/validate-routing.mjs` e `python3 references/calculo/verify.py` (deve dar 32 checks, 0 falhas). Resuma em ≤ 15 linhas o que entendeu e liste qualquer inconsistência que encontrar.

PASSO 1 — Especificar (agente `spec-architect`, tier premium)
Rode /grill-with-docs sobre docs/sdd/spec-v1.md, começando pela pergunta 0 (offline/PWA, ADR-0007: a web v1 é instalável e funciona offline — RF-070…RF-080, RNF-012…RNF-017, tickets T-13…T-15) e depois pelas demais "Perguntas em aberto". Faça as perguntas em rodadas, com sua recomendação em cada uma, e espere minhas respostas. Atualize GLOSSARY.md e crie/ajuste ADRs conforme decidirmos (ADR-0004 sobre os 80 ha precisa da minha confirmação). Depois rode /to-spec e publique a spec em .scratch/web-v1/spec.md (tracker local), mantendo os IDs RF/RN/RNF do doc de requisitos. PARE e peça minha aprovação da spec.

PASSO 2 — Planejar
Com a spec aprovada: defina os seams de teste (preferir poucos e altos: funções públicas de packages/domain, rotas HTTP da API, 2 jornadas e2e) e confirme comigo. Rode /to-tickets a partir de docs/sdd/tasks.md (ajuste granularidade/bloqueios) e publique em .scratch/web-v1/issues/. PARE e peça aprovação da quebra.

PASSO 3 — Implementar em loop (comece pelo T-01, depois T-02/T-03 em paralelo se não houver bloqueio)
Para cada ticket use /implement (ou /implement-spec para vários), com a skill tdd: um teste vermelho → implementação mínima → verde, sempre em fatias verticais. Regras:
 • Antes de delegar, consulte o modelo com `node scripts/route-model.mjs <tarefa>` (veja .claude/config/model-routing.json). Comece no tier mais barato que resolve; escale UMA vez se o mesmo erro falhar 2×; nunca use o tier frontier.
 • Gate por iteração: typecheck + teste do arquivo + lint. Ao fim do ticket: suíte completa + `pnpm test:parity` + `node scripts/trace-check.mjs`.
 • Máximo de 5 iterações por ticket. Se estourar, rode /handoff com o diagnóstico e pare.
 • T-02/T-03 (domínio): use a skill spreadsheet-parity. Os valores esperados vêm de tests/fixtures/golden.json (valores das células das planilhas), com tolerância relativa 1e-6. Dinheiro e peso em Decimal.
 • UI: use a skill design-to-code a partir de references/design/ (somente leitura). Campo branco = entrada, menta + cadeado = calculado.
 • Nenhuma regra de negócio inventada: se faltar, pergunte.
 • Ao fechar cada ticket: /code-review (agente code-reviewer), corrija "bloqueia", atualize docs/sdd/traceability.md (docs-keeper), registre uma linha em docs/engenharia/custos.md e faça commit (mensagem convencional). Não faça push nem merge.

PASSO 4 — Entrega do marco
Quando T-01…T-07 e T-17 estiverem verdes: demonstre o fluxo "cadastrar compra e venda → saldo" e "simular recria → resultado" em localhost, compare visualmente (Playwright, 1440 px e 390 px) com as telas WebCompraVenda e WebRecria do design e liste divergências. Resuma o custo (pontos de custo por tier) e o que ficou em aberto.

Comece agora pelo PASSO 0 e vá até o PASSO 1; não avance sem minha aprovação.
```

---

## Atalhos úteis
| Quero… | Comando |
|---|---|
| Refinar a spec | `/grill-with-docs` → `/to-spec` |
| Quebrar em tickets | `/to-tickets` |
| Implementar um ticket | `/implement <ticket>` |
| Implementar o plano inteiro em paralelo | `/implement-spec` |
| Revisar | `/code-review <ref>` |
| Bug difícil | `/diagnosing-bugs` |
| Passar o bastão a outra sessão | `/handoff` |
| Explicar de forma simples o que o agente disse | `/wait-what` |
| Qual modelo usar? | `node scripts/route-model.mjs <tarefa>` |

## Custos: regras práticas
- Spec/arquitetura/segurança → opus (poucas chamadas, alto valor). Código e testes → sonnet. Leitura, docs, fixtures, commits → haiku.
- Compacte aos 60% de contexto; uma sessão por ticket; use `/handoff` para continuar.
- Preencha `pricing_usd_per_mtok` no JSON com os preços do seu plano para relatórios exatos.
