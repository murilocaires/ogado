# Correções da auditoria — 20/10/2026

Autorização: pedido do dono para aplicar as recomendações por prioridade. Fonte: `docs/auditoria/2026-10-19/PARECER-COMPLETO.md` e pareceres vinculados.

## Escopo e critérios

1. P1 SEC-02/03/04 — RF-002/004/005, RNF-003: recuperar senha e mudar credenciais são operações transacionais; links anteriores não sobrevivem à troca de senha/e-mail; emissão concorrente deixa no máximo um link utilizável; consumo revoga os demais; rehash técnico não equivale a troca de senha. Terceira chamada comum com limite global 2 responde 429.
2. P1 ARQ-01 — RF-073/074/078, RNF-014/017: persistência e sincronização preservam lançamentos de duas abas, inclusive após recarga; migração de dados locais preserva IDs, fila, versões e identidade. Falhas de armazenamento não são sucesso silencioso.
3. P1 ARQ-02/03 — RF-030/032/035/074/079, RN-023, RNF-001/017: contrato de cenário completo, versionado e compartilhado; payload incompleto é rejeitado; item legado inválido não interrompe itens válidos; snapshot conserva todas as variantes e permite replay exato. Preservar a variante de cabeças inteiras já presente nas alterações locais; não inventar nova fórmula nem apagar histórico.
4. P2 — RNF-003/008: erros de provedores são categorias sanitizadas; dados autenticados não são cacheados; HTML recebe políticas de segurança compatíveis. Dependências vulneráveis são atualizadas de forma compatível e auditadas. Harness exige banco explicitamente identificado como teste antes de migrar/limpar.
5. P2 ARQ-04/05/07 — RNF-001/002/017, RF-036/074: seleção do melhor cenário é linear; precisão não depende de consumidores externos; pull incremental tem cursor estável, páginas limitadas e retomada sem perda de tombstones.
6. P2 ARQ-06/08 — RN-009, RF-076, RNF-005/006/010: alinhar documentação às decisões existentes, corrigir seletores E2E e interferência de instrumentação; CI executa checks significativos e diferencia requisitos futuros de requisitos vigentes, sem fabricar cobertura.

7. **Steering explícito de 20/10/2026 — RN-009:** o dono corrigiu a lotação da interface para lotação total em UA / área pastável informada. A simulação atual sempre usa `areaPastavel`, inclusive após abrir legado `fixa80`; área vazia/zero fica indefinida. Snapshots históricos não são reescritos e o ouro original continua testado no domínio. ADR-0017 registra a substituição da exceção anterior da interface.

## Testes autorizados e seams

Usar as interfaces já aprovadas da spec/relatório: HTTP Fastify + PostgreSQL real descartável; contratos públicos Zod; domínio puro e replay; interface pública do repositório e motor de sync; navegador real para multiaba/offline/UI. TDD por regressão comportamental, ouro independente, sem reescrever fórmulas esperadas. Evitar testes de implementação privada.

## Execução

Preservar alterações locais preexistentes e as evidências históricas. Registrar resultados novos em `docs/auditoria/2026-10-20-correcoes/`. Frentes independentes com arquivos exclusivos; alterações que compartilhem contratos serão coordenadas antes de integração. Testes pesados e serviços locais em sequência para respeitar a memória do computador. Não publicar nem acessar produção.
