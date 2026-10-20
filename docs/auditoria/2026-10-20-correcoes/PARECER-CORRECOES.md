# Parecer das correções — 20/10/2026

**Estado: validação final em andamento.** Este arquivo acompanha a implementação autorizada das recomendações, por prioridade. O parecer e as evidências de 19/10 permanecem preservados em `../2026-10-19/`.

## Alterações implementadas

| Prioridade | Correção |
|---|---|
| P1 — segurança | Ciclo de credenciais transacional; links anteriores revogados; emissão concorrente serializada; login não cria sessão após revogação da senha; limite global ativo |
| P1 — integridade | IndexedDB com entidade/outbox atômicas, migração preservada, coordenação entre abas, confirmação de gravação nas telas e retry com o mesmo ID |
| P1 — cenários | Contrato completo compartilhado, versão/variantes/parâmetros no snapshot, replay legado e quarentena por item inválido |
| P1 — revisão adicional | Respostas antigas de sessão descartadas; requisições vinculadas ao usuário que iniciou a operação; proteção do proprietário do banco local e da migração sob falha de armazenamento |
| P2 — desempenho | Seleção de destaques linear, Decimal isolado, pull paginado com checkpoint durável e timestamps do servidor ordenados por commit da fazenda |
| P2 — endurecimento | Logs sanitizados, no-store, CSP e demais cabeçalhos HTML, atualização transitiva do Lodash, guardião obrigatório de banco de teste |
| P2 — qualidade | Correção de helpers E2E; CI com trace estrito, audit, orçamento de cálculo e jornadas local/API/offline; reconciliação de requisitos/ADRs; atualização legal e hashes |
| RN-009 — pedido adicional do dono | Lotação da simulação = UA total / área pastável informada, inclusive ao abrir legado no simulador; área vazia/zero fica indefinida (ADR-0017) |

Detalhes: [segurança](seguranca.md), [cenários](cenarios.md), [persistência](persistencia.md) e [identidade durável](identidade-duravel.md). A revisão em dois eixos está em [Standards](review-standards.md) e [Spec](review-spec.md). Achados adicionais dessas revisões estão sendo fechados com regressões antes do encerramento.

## Validações concluídas nesta etapa

| Gate | Resultado comprovado | Evidência |
|---|---|---|
| Typecheck dos cinco pacotes/apps | Passou, antes dos últimos achados de revisão | [typecheck](evidencias/typecheck-final.txt) |
| ESLint da raiz | Passou, antes dos últimos achados de revisão | [lint](evidencias/lint-final.txt) |
| Domínio com cobertura | **132/132**; linhas/statements/funções 100%; branches **97,91%** | [domínio](evidencias/domain-coverage-final.txt) |
| Contratos | **49/49**, antes do último ajuste de hash legal | [contratos](evidencias/contracts-final.txt) |
| API com PostgreSQL real | **227/227**, antes do header de contexto; foco posterior **15/15** inclui os cinco casos novos | [API](evidencias/api-final.txt), [contexto](evidencias/security-context-green.log) |
| Web | **429/429** na execução completa inicial; foco posterior de sessão/UI **49/49**, incluindo um teste novo | [web](evidencias/web-unit.txt), [sessão/UI](evidencias/sessao-ui-final.txt) |
| IndexedDB real em Edge | **6/6**, antes do endurecimento adicional de migração/identidade | [persistência](evidencias/persistencia-browser-final.txt) |
| Paridade | **181/181** | [paridade](evidencias/parity-final.txt) |
| Dependências | **Zero vulnerabilidades conhecidas**, 582 dependências consideradas | [audit](evidencias/audit-final.txt) |
| Rastreabilidade estrita | Passou: 81/86 IDs em testes; cinco tratados explicitamente como gates/adiados/fora de escopo | [trace](evidencias/trace-strict.txt), [política](../../sdd/test-coverage-policy.json) |
| Build API | Passou na primeira integração | [build](evidencias/build-api-final.txt) |
| Playwright local em produção | **11/14** na primeira execução; três falhas de helpers sob correção/revalidação | [jornadas](evidencias/e2e-local.txt) |

As execuções focadas se sobrepõem às completas e não são somadas novamente. O encerramento substituirá esta matriz pelos resultados finais do código integrado. Não foi executado CI remoto nem deploy.

## Desempenho medido

No microbenchmark final, a recria pura teve p95 **0,3081 ms**, em 1.000 amostras, orçamento 50 ms. A seleção de destaques de 5.000 cenários teve p95 **15,8815 ms**, em 100 amostras, orçamento 1.000 ms. A implementação anterior fazia buscas repetidas O(N²); agora a seleção percorre a coleção uma vez. Na auditoria anterior, 5.000 cenários levaram p50 16.560,65 ms em cinco amostras. As coletas têm amostras/percentis distintos e não sustentam uma razão exata de aceleração. [Dados atuais](evidencias/performance-final.txt).

Esses números medem funções locais, sem HTTP, disco do navegador ou renderização. Não aprovam o p95 de toda a API nem o desempenho a frio de um telefone.

## Ambiente e implantação

Testes PostgreSQL usam exclusivamente `ogado-correcoes-20261020-security`, porta 55440, banco explicitamente de teste, tmpfs e limite de 512 MiB. O banco de desenvolvimento na porta 5432 foi preservado. A migração nova de índices é aditiva e foi validada no banco descartável; não foi aplicada em produção. Fonte de alterações: working tree sobre `912e38f73d5a7c2792dfef72e0ebc81b93424a20`, conservando as sete alterações locais preexistentes.

Windows, Node 22.23.2, pnpm local 11.13.0 (declarado 11.13.1), Edge e PostgreSQL 17.11. Comandos e tempos estão nos JSONs de execução. Esbuild/Next/navegador e Docker exigiram execução fora do sandbox. Não houve commit, push ou publicação.

## Limites que permanecem fora desta correção

Validação humana de acessibilidade, iOS/Android reais, descarte de armazenamento pelo sistema operacional, carga HTTP representativa/distribuída, soak, OAuth Google e entrega real de e-mail continuam exigindo seus próprios ambientes. A CSP da shell estática/PWA permite inline do framework; não representa proteção integral contra XSS. Rate limit em memória não é um limite distribuído. Os documentos legais continuam rascunhos com marcadores do controlador a preencher e revisão jurídica pendente.

A política de conflitos foi reconciliada com a sincronização automática já implementada em `d36a844`; não foi criada uma nova decisão de negócio. A variante de cabeças inteiras já usada pela interface foi preservada e versionada: R$ 103.307,60 no exemplo. O ouro fracionário do domínio permanece R$ 102.408,05, e cenários antigos conservam sua variante.

## Atualiza??o na prepara??o do push

Web integrado: 442/442 testes aprovados (evidencias/web-integrado.txt). Typecheck, lint e contratos integrados aprovados; contratos 49/49. Persist?ncia real: 8/8; identidade real: 7/7. A execu??o integrada da API e as jornadas finais ainda n?o estavam encerradas; os resultados parciais acima n?o representam aprova??o desses gates.

A tentativa api-integrado terminou com erro do schema engine do Prisma no migrate deploy, antes de executar testes. Evid?ncia: evidencias/api-integrado.txt. Portanto, n?o substitui a execu??o anterior de 227/227 nem aprova o conjunto integrado final.
