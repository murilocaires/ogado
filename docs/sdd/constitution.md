# Constituição do projeto Bovaro

Princípios inegociáveis. Mudar qualquer um exige ADR aprovado por humano.

1. **A spec manda.** Nada é implementado sem requisito numerado (RF/RN/RNF) e critério de aceite. Código diverge da spec → corrija um dos dois, nunca ignore.
2. **Paridade com as planilhas é lei (v1).** Para as mesmas entradas, mesmos números (≤ 1e-6 relativo). Divergência só como opção explícita, padrão igual à planilha.
3. **Test-first em seams acordados.** Red → green; testes validam comportamento público, nunca implementação; valores esperados vêm de fonte independente (planilha/ouro).
4. **Decimal em dinheiro e peso.** Proibido `float` em regra de negócio e persistência.
5. **Domínio puro e profundo.** Regras de negócio em `packages/domain` sem I/O; interfaces pequenas, módulos profundos.
6. **Multi-tenant por padrão.** Toda consulta escopada por `fazendaId`; testes de isolamento obrigatórios.
7. **Validar nas bordas com Zod**; tipos derivados do schema; sem `any`.
8. **Vertical slices.** Tickets atravessam schema → API → UI → testes e são demonstráveis sozinhos.
9. **Loops limitados e com gate.** Máx. 5 iterações por ticket, escalonar modelo uma vez, depois parar e fazer handoff. Orçamento de custo respeitado (`.claude/config/model-routing.json`).
10. **Humano no controle** de: regras de negócio, aprovação de spec, merge, migração destrutiva, tier frontier, publicação.
11. **Fontes de verdade imutáveis**: `references/` é somente leitura (hook de proteção).
12. **Acessibilidade e UX**: WCAG AA, estados completos, campo branco = entrada, menta + cadeado = calculado.
13. **Segurança básica sempre**: sem segredos no repo, senha com argon2id, rate limit, logs sem PII.
14. **Simples primeiro.** Sem abstração especulativa; refatore quando o segundo uso real aparecer.
