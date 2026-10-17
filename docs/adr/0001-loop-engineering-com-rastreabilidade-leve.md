# ADR-0001 — Loop engineering com matriz de rastreabilidade (em vez de graph engineering)

**Status:** aceito · **Data:** 2026-10-17

## Contexto
Precisávamos escolher como orquestrar agentes em um fluxo SDD: *graph engineering* (modelar requisitos, código, testes e decisões como grafo consultável, com agentes navegando-o) ou *loop engineering* (ciclos curtos e limitados, com portões de verificação objetivos).

## Decisão
**Loop engineering como método principal**, com uma **matriz de rastreabilidade** (tabela Markdown + `trace-check.mjs`) fazendo o papel de "grafo mínimo". O único grafo real que mantemos é o **grafo de tickets** (bloqueios), nativo de `to-tickets`/`implement-spec`.

## Por quê
- O projeto é pequeno/médio, com um domínio **fechado e verificável** (planilhas → números de ouro). O maior risco é cálculo errado, e o que o detecta é um *gate* (paridade), não uma consulta a grafo.
- Loops com gate dão feedback rápido, custo previsível (limite de iterações + orçamento) e se encaixam em TDD (red-green) e no roteamento de modelos (escalonar só quando o gate falha).
- Um grafo de conhecimento exige infraestrutura, indexação e manutenção; o ganho aparece em bases grandes e antigas, que não é o caso.
- A rastreabilidade ID → ticket → teste → código cobre 90% do valor (auditar cobertura de requisito) a custo ~zero.

## Consequências
- (+) Simples, barato, auditável, reproduzível por qualquer agente.
- (−) Navegação semântica entre requisitos é manual. Mitigação: IDs estáveis, GLOSSARY e grep.
- Revisitar se: o repositório passar de ~100 mil linhas, houver 3+ módulos de domínio (Cria, Metas, Fechamento) com dependências cruzadas, ou o `trace-check` deixar de bastar. Aí avaliar um índice de grafo (ex.: dependência de código + requisitos) como ferramenta de apoio, ainda dentro dos loops.

## Alternativas rejeitadas
Graph-first (custo/benefício ruim agora); agentes autônomos sem gate (risco de deriva e custo).
