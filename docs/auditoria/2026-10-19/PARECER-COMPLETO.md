# Auditoria técnica do O Gado — 19/10/2026

Revisão de encerramento retomada em **20/10/2026**, após a interrupção por créditos. Os resultados da coleta original foram preservados; medições complementares estão identificadas separadamente.

## Parecer executivo

**Não recomendo aprovar a aplicação para publicação sem tratar os bloqueadores de segurança e integridade abaixo.** Compilação, análise estática e os 782 testes existentes de domínio, contratos, API e interface passaram. As verificações adicionais encontraram problemas que essas suítes não detectavam. Aprovação em testes automatizados não equivale à aprovação de todos os requisitos.

Os bloqueadores principais são o ciclo de recuperação de senha, o limite global de requisições inoperante, a sobrescrita de dados offline entre instâncias do armazenamento, cenários aceitos pelo contrato que interrompem a sincronização e snapshots que não reproduzem o resultado salvo. Há também falhas nas jornadas Playwright e lacunas de rastreabilidade.

Este documento consolida [segurança](seguranca.md), [integração](integracao.md) e [arquitetura e desempenho](arquitetura-performance.md). Os detalhes, comandos, localizações no código e limitações estão nesses pareceres e nos artefatos de [evidências](evidencias/).

## Escopo, instruções e ambiente

- Estado de trabalho do commit `912e38f73d5a7c2792dfef72e0ebc81b93424a20`, incluindo as alterações locais que já existiam em sete arquivos. Elas foram preservadas. Worktrees anteriores não foram auditadas como cópias independentes do produto.
- Referências: `CLAUDE.md`, constituição, glossário, requisitos RN/RF/RNF, spec v1 e ADRs relevantes. Papéis de `.claude/agents/`: test-engineer, code-reviewer, spec-architect/explorer e consolidação documental. São orientações aplicadas por agentes Codex; não houve execução dos modelos Claude citados no roteador local.
- Skills aplicadas: `spreadsheet-parity`, `traceability`, `code-review`, `codebase-design`, `improve-codebase-architecture`, e orientações pertinentes de `tdd`/`zod-contracts`. A revisão cobriu o estado atual inteiro, em dois eixos: Standards e Spec. O pedido de Markdown prevaleceu sobre a apresentação HTML sugerida pela skill arquitetural.
- Windows x64, Node `22.23.2`, pnpm instalado `11.13.0` versus declarado `11.13.1`, Vitest `5.0.5`, Next `16.4.2`, Edge local, PostgreSQL `17.11`, CPU Intel i7-1165G7 e aproximadamente 7,73 GiB de RAM.
- PostgreSQL exclusivo, descartável, em `127.0.0.1:55439`, banco `ogado_auditoria_20261019`, container `ogado-auditoria-20261019-integration`, com limite de 512 MiB. Nenhum banco existente foi migrado, limpo ou usado como destino de teste. O container temporário foi parado e removido após os E2E; a retomada confirmou sua ausência e a preservação do banco de desenvolvimento. [Evidência da limpeza](evidencias/integracao-limpeza.log).
- Não foram alterados código de produção, fórmulas, migrações, configurações de implantação, documentos legais ou fontes em `references/`. Foram acrescentados relatórios, evidências e runners de auditoria em `.scratch/auditoria-2026-10-19/`. Não houve deploy, commit, push ou execução contra produção.

Horários nos JSONs estão em UTC; a data do relatório corresponde a `America/Bahia`. A máquina foi compartilhada entre processos. Durante a primeira rodada houve apenas cerca de 0,15 GiB livres; execuções afetadas foram interrompidas e o frontend foi reexecutado com um worker. Medições de desempenho devem ser repetidas isoladamente antes de definir orçamentos de produção.

## Matriz de execução

| Verificação | Resultado | Evidência e interpretação |
|---|---|---|
| Typecheck de cinco pacotes/apps | PASSOU | [typecheck](evidencias/typecheck.txt), código 0, 62,75 s |
| ESLint da raiz, excluindo somente os novos artefatos de auditoria | PASSOU | [lint-root](evidencias/lint-root.txt), código 0, 20,76 s; lint de apps/packages/scripts também passou |
| Domínio com cobertura | PASSOU | 6 arquivos, **130 testes**, [domínio](evidencias/domain-coverage.txt) |
| Contratos Zod | PASSOU | 5 arquivos, **45 testes**, [contratos](evidencias/contracts.txt) |
| API completa com PostgreSQL real | PASSOU | 22 arquivos, **195 testes**, 98,05 s Vitest, [integração](evidencias/integracao-completa.log) |
| Interface e bibliotecas web | PASSOU | 31 arquivos, **412 testes**, 159,12 s Vitest, [web](evidencias/web-unit-final.txt) |
| Total das suítes Vitest completas | PASSOU | **782 testes em 64 arquivos**; os 3 unitários API executados separadamente já estão contidos nos 195 e não são somados de novo |
| Cobertura do domínio | PASSOU | Linhas/statements/funções **100%**; branches **97,88% (139/142)**; supera gate de 95% |
| Paridade Node/oráculo/domínio/ouro | PASSOU | **181 verificações**, tolerância relativa `1e-6`, [paridade](evidencias/parity.txt) |
| Paridade das células XLSX | PASSOU COM ADAPTADOR | **32 células, zero divergências**, [XLSX](evidencias/parity-xlsx-portable.txt). O verificador original falhou no caminho Windows; o adaptador só substitui o carregamento JS, mantendo as comparações originais |
| Migrações no banco vazio exclusivo | PASSOU | **8/8**, detalhes em [integração](integracao.md); não comprova uma atualização em volume produtivo |
| Build da API | PASSOU | 16,79 s, [build API](evidencias/build-api.txt) |
| Build Next de produção | PASSOU | 120,87 s, [build web](evidencias/build-web.txt) |
| Consistência de agentes/skills/roteador | PASSOU | 23 tarefas, 4 tiers, [roteador](evidencias/routing.txt) |
| Rastreabilidade estrita | FALHOU | **74/86 IDs encontrados**, 12 sem referência, [trace](evidencias/trace-strict.txt) |
| Probes adicionais de segurança | ACHADOS | 40 controles aprovados; limite global e log inseguro reproduzidos; 3 fluxos problemáticos de recuperação no banco real; [segurança](seguranca.md) |
| Varredura heurística de segredos | SEM DETECÇÕES | 434 arquivos rastreados, [scanner](tracked-secret-scan.json). Não cobre histórico Git nem todos os formatos de segredo |
| Auditoria de dependências | FALHOU | 581 dependências consideradas, **1 alerta alto e 2 moderados**, todos relacionados ao Lodash transitivo, [audit](evidencias/dependency-audit-network.txt) |
| Playwright local | FALHOU | **5 passaram, 8 falharam**, 13 casos executados; [relatório](evidencias/e2e-local-report.json), detalhes abaixo |
| Playwright API integrada | PASSOU APÓS CORRIGIR O RUNNER | 25/26 na primeira execução; o único caso falhou na preparação por diretório incorreto do runner e **passou na reexecução isolada**. Resultado final por caso: **26/26** |
| Playwright PWA/offline | FALHOU PARCIALMENTE | **3 passaram, 1 falhou** aguardando rótulo antigo no helper da recria, antes da comparação do ouro; [relatório](evidencias/e2e-offline-report.json) |
| Axe WCAG 2.2 AA e overflow | SEM VIOLAÇÕES DETECTADAS | axe-core **4.14.0**, **14 estados válidos HTTP 200**, zero violações e zero transbordamento; há regras inconclusivas para revisão humana, [axe](evidencias/accessibility.json) |
| Performance HTTP local | PARCIAL APROVADO | 250 requisições medidas, todas 200, somente `/health`; [HTTP](evidencias/performance-http.json) |
| Microbenchmarks de domínio, armazenamento e sync | CONCLUÍDOS / DIAGNÓSTICO | **16 casos completos**: 13 da coleta inicial e 3 concluídos na retomada sequencial; [arquitetura](arquitetura-performance.md), [retomada](evidencias/performance-retomada.json) |

Os arquivos `.json` com o mesmo nome dos comandos registram comando, argumentos, início, fim, duração e exit code. Os resultados de asserções de API e Playwright têm relatórios JSON próprios. Um exit code não zero por infraestrutura foi distinguido de reprovação de comportamento.

## Standards: segurança e implementação

| Prioridade | Achado confirmado | Ação e critério para encerrar |
|---|---|---|
| P1 / bloqueia | **SEC-03:** token de reset emitido antes de mudar e-mail ou senha continua permitindo redefinir a senha e entrar | Revogar tokens pendentes na mesma transação das mudanças de credenciais, conforme política explícita; provar que token anterior passa a falhar nos dois fluxos |
| P1 / bloqueia | **SEC-04:** duas emissões concorrentes geram dois tokens resgatáveis, inclusive depois do primeiro reset | Serializar a emissão por usuário e invalidar todas as recuperações pendentes no resgate; teste concorrente com PostgreSQL real |
| P1 / bloqueia | **SEC-02:** limite global com máximo 2 permite três respostas 200 | Concluir registro de plugins antes das rotas, ou aplicar hook global explicitamente; terceira chamada comum deve retornar 429 com `Retry-After` |
| P1 / integridade | **ARQ-01:** duas instâncias do repositório sobrescrevem o envelope local; reabrir recupera 1 de 2 lotes | Persistência transacional por entidade/fila e coordenação entre abas; fechar/reabrir ambas offline sem perder os dois registros |
| P1 / integridade | **ARQ-02:** mapas vazios passam no contrato de Cenário, o mapper os rejeita e a sincronização termina em erro | Contrato completo/versionado, compatibilidade e tratamento recuperável por item; cenário inválido não deve bloquear os válidos |
| P1 / integridade | **ARQ-03:** snapshot omite `cabecasInteiras`, embora altere o resultado | Registrar variante e versão de cálculo; salvar, sincronizar, reabrir e recalcular deve reproduzir todos os valores |
| P2 | **SEC-01:** erros arbitrários do adaptador de e-mail chegam ao log | Categorias fixas/sanitização; testes de não vazamento nos dois sinks. O adaptador atual de Resend usa mensagem fixa: não foi demonstrado vazamento real desse provedor |
| P2 | **SEC-05:** Lodash vulnerável em cadeia transitiva Prisma Studio/visx | Atualizar a cadeia/override compatível, verificar alcance no artefato de produção e repetir audit, build e testes; não tratar alerta do scanner como exploração demonstrada |
| P2 | Harness de integração usa fallback para banco de desenvolvimento e aplica migrações/limpeza sem guardião do destino | Exigir `TEST_DATABASE_URL` e comprovar destino descartável antes de migrar/limpar; falhar fechado quando ausente |

As provas não atingiram contas reais. Credenciais e dados sintéticos do banco descartável não são segredos de produção. Detalhes das etapas e arquivos: [segurança](seguranca.md), [integração](integracao.md) e [reproduções arquiteturais](evidencias/performance-regressoes.json).

O scanner identifica Lodash `4.17.21`. Avisos oficiais: [injeção em template](https://github.com/advisories/GHSA-r5fr-rjxr-66jc), [poluição de protótipo por array path](https://github.com/advisories/GHSA-f23m-r3pf-42rh) e [poluição em unset/omit](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg). A página oficial do primeiro recomenda `4.18.0`; o JSON do registry informa faixa corrigida diferente (`>=4.17.24`). Escolher uma versão publicada suportada que resolva os três alertas e revalidar compatibilidade, sem assumir que trocar apenas o número seja suficiente.

## Spec: aderência aos requisitos e às decisões

1. **Paridade do domínio aprovada; experiência da recria exige reconciliação.** A função pura preserva o ouro fracionário da planilha. A ponte da UI força `cabecasInteiras: true`: o caso de ouro gera 60 cabeças e líquido de R$ 103.307,60, contra aproximadamente 59,773 cabeças e R$ 102.408,05 do domínio padrão. O snapshot não registra a opção. Não foi tomada decisão de negócio nesta auditoria; é preciso tornar a variante e sua aprovação explícitas e testar ouro independente no fluxo completo.
2. **Persistência difere do ADR-0007.** A implementação usa envelopes em `localStorage`; o ADR prevê IndexedDB/Dexie com fila durável. A diferença tem efeito reproduzido de perda entre instâncias, não é apenas preferência tecnológica.
3. **Política de conflitos diverge das fontes.** Código e `docs/sincronizacao-automatica.md` adotam resolução automática; RF-076, ADR-0007 e matriz ainda descrevem escolha manual. Atualizar requisito, ADR, critérios e testes para a política aprovada antes de alegar conformidade.
4. **Lotação inicial após novo/limpar.** ADR-0014 descreve área pastável, mas o repositório local mantém `fixa80`. É uma divergência de configuração do simulador, distinta do cálculo financeiro.
5. **Rastreabilidade lexical incompleta.** Sem referência encontrada: `RN-005`, `RF-003`, `RF-022`, `RF-042`, `RF-050`, `RF-060`, `RNF-002`, `RNF-005`, `RNF-006`, `RNF-008`, `RNF-010`, `RNF-014`. Parte desses comportamentos foi exercitada nesta auditoria ou indiretamente nas suítes; o checker procura IDs textuais e não prova execução ou qualidade das asserções. Não se deve marcar todos os 86 requisitos como aprovados. O comando sem `--strict` não reprova somente por IDs ausentes.

## Desempenho: medições e limites

| Medição | Amostra e carga | Resultado |
|---|---|---|
| Recria pura | Microbenchmark aquecido, entradas fixas e Decimal | p95 aproximadamente **0,204 ms**, abaixo dos 50 ms de RNF-002 nesse recorte |
| Seleção do melhor cenário | 1.000 cenários, uma passagem por todos os selos, sem React | p95 aproximadamente **2.488 ms**; busca repetida causa **O(N²)** |
| Resumo de lotes | 10.000 lotes | p50 **475,73 ms**, p95 **980,99 ms**; volume aumenta custo de cálculo/serialização |
| Leitura local simulada | 10.000 lotes, adapter em memória | p50 **56,34 ms**, p95 **103,86 ms**; não mede disco/DOM de celular e não certifica RNF-013 |
| API `/health` + PostgreSQL | 20 warmups; 50 medições, concorrência 1 | p50 **24,48 ms**, p95 **84,87 ms**, **29,36 req/s**, 50/50 HTTP 200 |
| API `/health` + PostgreSQL | 200 medições, concorrência 10 | p50 **65,45 ms**, p95 **258,47 ms**, máximo **533,68 ms**, **95,72 req/s**, 200/200 HTTP 200 |
| Seleção do melhor cenário, retomada | 5.000 cenários; 1 warmup, 5 amostras; sem React | p50 **16.560,65 ms**, máximo **19.920,63 ms**; cinco amostras não certificam um p95 estável |
| Sync sem alterações, retomada | 1.000 lotes; adapters HTTP/Storage em memória; 5 warmups, 30 amostras | p50 **8,77 ms**, p95 **12,23 ms** |
| Sync sem alterações, retomada | 10.000 lotes; adapters HTTP/Storage em memória; 5 warmups, 30 amostras | p50 **88,57 ms**, p95 **126,93 ms** |

As medições HTTP usam o build real em modo produção, rede localhost e `SELECT 1` no PostgreSQL isolado. O p95 ficou abaixo de 300 ms nesse endpoint e nessa carga; isso não aprova o p95 de login Argon2, listagens, exportações ou sincronização com dados volumosos. Não foram executados stress até falha, soak prolongado, carga distribuída ou medição de celular médio.

As três medições interrompidas por RAM na coleta inicial foram **concluídas em 20/10/2026**, em um processo sequencial, sem build ou outra suíte da auditoria concorrente. A execução durou 110,63 s, código 0; havia aproximadamente 1,31 GiB livres no início e 1,27 GiB no fim. As evidências anteriores foram preservadas. A [validação independente da sincronização](evidencias/performance-sync-validacao.json) retornou `ok` e confirmou 1.000/10.000 lotes, versões e bases preservados. Esses resultados medem reconciliação/serialização em memória de conjuntos já sincronizados, sem rede, disco do navegador, envio de pendências ou PostgreSQL; não são uma medição de sync ponta a ponta.

## Sugestões arquiteturais priorizadas

Manter o monorepo, o domínio puro compartilhado com Decimal, os contratos Zod e PostgreSQL. Os achados não justificam uma troca de stack ou microserviços. Aumentar a depth dos módulos existentes com interfaces pequenas, preservando os seams e adapters já reais; concentrar invariantes melhora locality e dá leverage às telas e aos testes.

| Ordem | Proposta | Esforço indicativo e validação |
|---|---|---|
| 1 | Concentrar o ciclo de credenciais em um módulo transacional; corrigir ordem dos plugins e sanitização de erros | Pequeno a médio; repetir os probes negativos e concorrentes, além dos 195 testes API |
| 2 | Aprofundar a persistência offline sob a interface do repositório: transações, fila atômica e coordenação entre abas | Médio; migração preservando IDs, cota cheia, recarga, duas abas, logout e isolamento de contas |
| 3 | Um contrato versionado de Cenário compartilhado, incluindo todas as variantes e versão da fórmula | Médio; replay exato após serialização/HTTP e compatibilidade de snapshots antigos |
| 4 | Calcular o melhor resultado uma vez por conjunto, eliminando a varredura por cartão | Pequeno; testar empate, nulos, filtro/exclusão e comparar 100/1.000/5.000 itens |
| 5 | Sincronização incremental paginada por cursor estável, retomada durável e tombstones | Médio a alto, após contrato/fila; interrupção antes/depois de checkpoint e concorrência com mesmo timestamp |
| 6 | Isolar a configuração Decimal com clone do construtor | Pequeno; alterar precisão global externa não pode mudar o resultado do domínio |
| 7 | Fortalecer CI com trace estrito, audit, E2E e contrato de desempenho reproduzível | Médio; exigir evidências dos fluxos de auth/sync/offline e budgets em ambiente estável |

Estimativas são ordens de grandeza, não compromisso de prazo. O parecer [arquitetural](arquitetura-performance.md) detalha oito candidatos, antes/depois, arquivos, riscos, vínculos com ADRs e testes de encerramento. Decisões de negócio permanecem com o dono do produto.

## Navegador, acessibilidade e offline

### Playwright local

**13 testes: 5 passaram e 8 falharam**, sem skips ou retries, em aproximadamente 12,4 minutos. Foram preservados o [JSON completo](evidencias/e2e-local-report.json), [log](evidencias/e2e-local.txt) e [traces/contextos](evidencias/playwright-local/).

| Grupo | Resultado e diagnóstico |
|---|---|
| Compra/venda desktop, navegação móvel, ajuda/Esc, desconto feminino, botão contextual | 5 aprovados |
| Recria em 390 e 1440 px | 2 falhas porque `getByLabel('Investimento', exact)` não encontra o rótulo atual `Investimento (compra)`; o caso para antes de comparar o ouro |
| Salvar/comparar/abrir cenários e lista móvel | 4 timeouts de 90 s aguardando os rótulos antigos do helper `e2e/planilha.ts`, como `Área pastável` versus `Área Pastável` |
| Compra/venda móvel e jornada extensa de layout | 2 timeouts de 90 s: o trace registra `nextjs-portal` do overlay de desenvolvimento interceptando o clique na navegação Painel. O saldo já estava correto no snapshot. É interferência da instrumentação do Next dev, não uma divergência de cálculo demonstrada |

Os testes existentes não foram alterados para obter aprovação. Uma [sondagem adicional com os rótulos atuais](evidencias/recria-browser-current.json) preencheu as mesmas entradas do ouro e confirmou no navegador **R$ 103.307,60** em vez de **R$ 102.408,05**; [captura](evidencias/recria-browser-current.png). Isso separa a manutenção necessária dos seletores da divergência de fórmula/variante no fluxo atual. Há mensagens `ECONNREFUSED` para sessão no servidor local sem API, coerentes com esse modo de teste; não foram usadas para reprovar o cálculo.

### Acessibilidade automatizada

Axe-core 4.14.0 em Edge real, tags WCAG 2 A/AA, 2.1 A/AA e 2.2 AA: `/entrar`, `/cadastrar`, `/painel`, `/negocios`, `/recria`, `/privacidade` e `/termos`, em **390 e 1440 px**. Todos os 14 estados responderam HTTP 200; nenhum erro de execução, nenhuma violação automática detectada, nenhum overflow horizontal.

O scanner deixou `color-contrast` inconclusivo em algumas telas e `label-content-name-mismatch` em telas do produto. Isso requer inspeção humana; zero violações automáticas não certifica WCAG AA. A coleta cobre estados iniciais, sem registros reais, e não cobre todos os diálogos, erros, cenários, leitor de tela, teclado, tamanho de todos os alvos ou toda a faixa de 360–1920 px.

### API integrada

**26 casos aprovados ao considerar a reexecução do caso de infraestrutura**, sem alterar testes ou código do produto. A [execução completa](evidencias/e2e-api-report.json) teve 25 aprovados e uma falha: o helper `set-aceite-termos.ts` foi chamado com um diretório incorreto porque o runner desta auditoria foi iniciado na raiz em vez de `apps/web`. Não foi uma asserção de comportamento do produto. Corrigido o diretório no runner temporário, o [mesmo caso de termos](evidencias/e2e-api-recheck-report.json) passou em 10,8 s de teste; a evidência inicial foi preservada. Não houve reexecução indiscriminada dos outros 25 casos.

Passaram cadastro/login/logout, erros de credenciais, foco, sessão expirada sem perda local, bloqueio de telas sem sessão, lote entre aparelhos A/B, fila offline e reconexão, indicador móvel, conflitos automáticos com histórico/mesclagem, CSV/XLSX/exportação da Conta, recuperação com resposta neutra, páginas legais, aceite versionado e capturas das telas de autenticação.

### PWA e funcionamento offline em produção

**4 testes: 3 passaram, 1 falhou**, aproximadamente 3 minutos, com build de produção e service worker ativos. [JSON](evidencias/e2e-offline-report.json), [log](evidencias/e2e-offline.txt) e [traces](evidencias/playwright-offline/).

- Aprovado: manifest `pt-BR`/standalone e arquivos de ícones 192/512/maskable, Apple touch icon e theme color.
- Aprovado: nenhuma requisição `/api/*` no cache do service worker.
- Aprovado: criar lote offline, visualizá-lo e enviá-lo ao servidor após reconectar.
- Falhou: abrir/calcular a recria e comparar o ouro. O helper espera `Área pastável`, enquanto a tela expõe `Área Pastável`; atinge 120 s antes de completar o preenchimento. **Não foi aprovada a jornada integral de cálculo offline pelo teste existente**, nem atribuída a falha a indisponibilidade do service worker sem evidência.

**Total único Playwright: 43 casos exercitados; 34 com resultado final aprovado e 9 ainda reprovados**, dos quais 7 envolvem helpers/rótulos desatualizados e 2 envolvem o overlay de desenvolvimento interceptando cliques. Houve uma execução adicional para corrigir a falha de infraestrutura do runner no caso de termos. Esse resumo não oculta a divergência financeira e os demais riscos confirmados pelos probes independentes.

As 11 capturas sintéticas das jornadas foram consolidadas em [jornadas-capturas](evidencias/jornadas-capturas/). Os cabeçalhos HTML também foram aferidos no [Next de produção local](evidencias/web-headers-production.json): faltam CSP, proteção de frame, referrer policy e nosniff nesse build; a implantação/CDN publicada não foi auditada.

## Encerramento da retomada — 20/10/2026

Conferidos os relatórios e seus links locais, os códigos de saída dos gates e os JSONs das jornadas. O banco temporário está ausente e o banco de desenvolvimento continua preservado. Foram concluídos os três microbenchmarks que faltavam e mantidas as falhas reais, as falhas de instrumentação e as limitações de escopo nos resultados. [Registro da conferência final](evidencias/encerramento-retomada.json). Não resta execução local planejada desta auditoria em aberto; as correções propostas e as validações em dispositivos/infraestrutura publicados constituem trabalho posterior, sem aprovação implícita dos requisitos reprovados.

## Limitações e reprodução

O resultado é uma auditoria local do estado inspecionado, não certificação ASVS/WCAG/LGPD nem pentest externo. Google OAuth e entrega real de e-mail não foram exercitados com credenciais/provedores externos; a suíte cobre adapters falsos e verificação de protocolo. Instalação em Android/iOS, abertura offline a frio em dispositivo médio, recuperação de backup, volume real, retenção de histórico e atualização de banco produtivo exigem validação própria.

No Windows, usar `pnpm.cmd`; o `.ps1` está bloqueado por política. A tentativa de obter o pnpm declarado falhou por acesso ao registry no sandbox, sem evidência de adulteração; os mesmos comandos foram executados com a versão local e `--pm-on-fail=ignore` (ou `pnpm_config_pm_on_fail=ignore` para subprocessos). Builds/esbuild, navegador e consultas de rede exigiram execução fora do sandbox; nenhuma rejeição de aprovação impediu os resultados finais desses gates.

Comandos centrais, na raiz, com o PostgreSQL explicitamente isolado antes dos testes API:

```powershell
pnpm.cmd --pm-on-fail=ignore -r typecheck
pnpm.cmd --pm-on-fail=ignore lint
pnpm.cmd --pm-on-fail=ignore test
pnpm.cmd --pm-on-fail=ignore --filter @ogado/domain test:coverage
node scripts/parity.mjs
node scripts/trace-check.mjs --strict
node scripts/validate-routing.mjs
pnpm.cmd --pm-on-fail=ignore build
pnpm.cmd --pm-on-fail=ignore audit --json
```

Na execução auditada, as suítes foram invocadas individualmente pelos mesmos binários locais e configurações, permitindo separar infraestrutura, tempos e resultados. Os comandos exatos estão nos JSONs de evidências. Os runners adicionais ficam em [.scratch/auditoria-2026-10-19](../../../.scratch/auditoria-2026-10-19/); não são uma nova suíte permanente de CI. O axe foi instalado apenas nessa pasta, com scripts de instalação desabilitados, sem alterar o manifesto ou lockfile do projeto.
