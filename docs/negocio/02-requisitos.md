# O Gado — Requisitos (v1 web)

Legenda de prioridade: **M** = must (v1) · **S** = should (v1.1) · **C** = could/futuro. Todo ID abaixo deve ter ao menos um teste com o ID no nome (`node scripts/trace-check.mjs`). Critérios no formato Dado/Quando/Então.

## 1. Regras de negócio (RN) — paridade com as planilhas

| ID | Regra | Origem | Pri. |
|---|---|---|---|
| RN-001 | Na compra, 1 @ = 30 kg de peso vivo. | Compra e Venda `F4` | M |
| RN-002 | Na venda, 1 @ = 15 kg; antes da conversão desconta-se 10 kg × cabeças: @ = (kg − qtd×10) ÷ 15. | `F11` | M |
| RN-003 | Peso do lote em 3 modos: total informado, médio × qtd, ou individual (soma dos pesos). Vale para compra e venda. | `E5`; pedido do cliente | M |
| RN-004 | Compra: total = @ × R$/@; R$/cab. = total ÷ qtd (calculado em todas as linhas). | `H4`,`I5` | M |
| RN-005 | Venda: total = @ × R$/@. | `H11` | M |
| RN-006 | Saldo = total de vendas − total de compras. | `H19` | M |
| RN-007 | Recria: cabeças = investimento ÷ R$/cab. de compra, sem arredondar (exibe arredondado). | Recria `B21` | M |
| RN-008 | UA total = cab × peso inicial ÷ 450. | `B23` | M |
| RN-009 | Lotação inicial (UA/ha) = UA total ÷ 80 (padrão da planilha); opção "pela área pastável" usa a área informada. | `B24` | M |
| RN-010 | Peso médio = (inicial + final) ÷ 2; lotação final = cab × peso médio ÷ 450 ÷ área. | `B26`,`B27` | M |
| RN-011 | @ produzidas (na venda) = peso final ÷ 30 × cab. | `B29` | M |
| RN-012 | Consumo de suplemento (kg/cab/dia) = peso médio × 0,3%; por dia do lote = × cab; custo total = × R$/kg × dias. | `F24`–`F27` | M |
| RN-013 | @ de carcaça/cab = peso final × 52% ÷ 15; venda/cab = @ × R$/@. | `J20`,`J21` | M |
| RN-014 | Imposto = venda/cab × 1,5% (por cab) e × cab (total). | `J23`,`J24` | M |
| RN-015 | Sanidade = dias ÷ 30 × cab × R$ 2,50. | `M20` | M |
| RN-016 | Custo operacional = suplemento + sanidade + imposto + frete + funcionário. | `B38` | M |
| RN-017 | Faturamento bruto (variante padrão `pesoVivo`, igual à planilha) = peso final ÷ 30 × cab × R$/@ de venda (`B29` × R$/@); variante `carcaca` (RN-023) = @ de carcaça/cab × cab × R$/@; **líquido = bruto − custo operacional − investimento**; total em caixa = investimento + líquido. | `E33`,`E35`,`E38` | M |
| RN-018 | Líquido/mês = líquido ÷ (dias ÷ 30); líquido/ha = líquido ÷ área. | `F33`,`F35` | M |
| RN-019 | GMD implícito = (peso final − inicial) ÷ dias (informativo). | derivado | S |
| RN-020 | Valores duplicados na planilha são um só campo no app (PA-03). | `F19-F21`,`B37` | M |
| RN-021 | Parâmetros padrão (30, 15, 10, 450, 52%, 1,5%, 0,3%, R$ 2/kg, R$ 2,50) são editáveis por fazenda com "restaurar padrão da planilha". | planilhas | M |
| RN-023 | Variantes de fórmula por fazenda (ADR-0008): `lotacaoInicial` = `fixa80`\|`areaPastavel`; `faturamentoBruto` = `pesoVivo`\|`carcaca`. Padrão = planilha. A simulação salva guarda a variante usada e o resultado a exibe. | decisão do pecuarista | M |
| RN-022 | Divisão por zero / campo vazio não quebra a tela: resultado mostra "—" e dica de preenchimento. | UX | M |

## 2. Requisitos funcionais (RF)

| ID | Requisito | Critério de aceite (resumo) | Pri. |
|---|---|---|---|
| RF-001 | Cadastro e login com e-mail/senha; entrada com Google. | Dado e-mail novo, quando cadastro, então conta criada e sessão iniciada. | M |
| RF-002 | Sessão segura, logout e recuperação de senha. | Senha reset por link expirável. | M |
| RF-003 | Primeiros passos: nome da fazenda, área pastável, confirmação dos parâmetros. | Fluxo de 3 passos conclui e leva ao painel. | M |
| RF-010 | Uma conta pode ter uma fazenda (v1); dados isolados por fazenda. | Usuário A nunca lê dados da fazenda B. | M |
| RF-011 | Configurações da fazenda: nome, área, parâmetros de cálculo e variantes de fórmula (RN-023), com "restaurar padrão da planilha". | Alteração reflete nos novos cálculos; cenários salvos não mudam. | M |
| RF-020 | CRUD de lotes de **compra** (categoria, qtd, modo de peso, R$/@, data). | Cria, edita, exclui (com confirmação). | M |
| RF-021 | CRUD de lotes de **venda**. | idem | M |
| RF-022 | Modo de peso individual: lista de pesos animal a animal; qtd = nº de pesos; peso = soma. | Colar lista, editar, remover pesos. | M |
| RF-023 | Resumo: cabeças, @, total por aba, **saldo** com sinal e cor. | Bate com o exemplo de ouro (−R$ 89.475,83). | M |
| RF-030 | Simulador de recria com todos os campos de entrada da planilha; recalcula ao digitar. | Resultado igual ao exemplo de ouro. | M |
| RF-031 | Resultado completo: custos (composição), bruto, líquido, caixa, por mês e por ha. | Valores e rótulos corretos (PA-02). | M |
| RF-032 | Salvar simulações por ano safra, duplicar e renomear. | Lista de cenários com data. | M |
| RF-033 | Comparar dois cenários lado a lado. | Diferenças destacadas. | S |
| RF-040 | Painel: saldo, últimas operações, atalhos, resumo da recria. | Reflete dados reais. | M |
| RF-041 | Exportar compras/vendas/simulações em CSV (e XLSX). | Arquivo abre no Excel com pt-BR. | S |
| RF-042 | Importar planilha Excel no formato do curso. | Pré-visualiza e confirma antes de gravar. | S |
| RF-050 | Estados: carregando, vazio, erro, offline, sucesso, confirmação destrutiva em todas as telas. | Conforme `WebEstados` (offline detalhado em RF-070…RF-080). | M |
| RF-051 | Campo calculado é somente leitura e visualmente distinto (menta + cadeado). | Não aceita digitação. | M |
| RF-060 | Integração Google Sheets (leitura). | Fora da v1. | C |

## 3. Requisitos não funcionais (RNF)

| ID | Requisito | Meta | Pri. |
|---|---|---|---|
| RNF-001 | Precisão: aritmética decimal em todo cálculo e persistência; sem `float` em dinheiro. | Paridade ≤ 1e-6 relativo com as planilhas | M |
| RNF-002 | Desempenho: recálculo no cliente < 50 ms; API p95 < 300 ms. | medido em CI/k6 simples | M |
| RNF-003 | Segurança: senha com argon2id, cookies HttpOnly/SameSite, rate limit, CSRF, headers (OWASP ASVS nível 1). | checklist de revisão | M |
| RNF-004 | Isolamento multi-tenant (`fazendaId` em toda query). | teste de integração dedicado | M |
| RNF-005 | Acessibilidade WCAG 2.2 AA; alvo de toque ≥ 44 px; teclado completo. | axe sem violações | M |
| RNF-006 | Responsivo 360–1920 px; navegação lateral vira barra inferior em tela estreita. | verificação visual | M |
| RNF-007 | Idioma pt-BR, moeda BRL, números `1.234,56`. | testes de formatação | M |
| RNF-008 | Observabilidade: logs estruturados, id de requisição, erros sem PII. | revisão | S |
| RNF-009 | LGPD: consentimento, exportação e exclusão de conta. | fluxo mínimo | S |
| RNF-010 | Qualidade: TS estrito, lint, cobertura de domínio ≥ 95%, CI em todo PR. | CI | M |
| RNF-011 | Reprodutibilidade: `docker compose up` sobe Postgres; seed com cenário de ouro. | README | M |
| RNF-012 | Instalabilidade: manifest completo, ícones 192/512/maskable, service worker, HTTPS. | Lighthouse "installable" passa | M |
| RNF-013 | Desempenho offline: abertura a frio do app instalado < 2 s; leitura local < 100 ms. | medido em dispositivo médio | M |
| RNF-014 | Segurança no aparelho: sem senha/token em IndexedDB/localStorage; SW não cacheia respostas autenticadas da API; dados locais por usuário + fazenda; apagados no logout. | teste + revisão | M |
| RNF-015 | Armazenamento: solicitar persistência; avisar cota quase cheia. | teste manual/e2e | S |
| RNF-016 | Compatibilidade: instalação nativa em Chrome/Edge (desktop e Android); iOS ≥ 16.4 via "Adicionar à Tela de Início"; demais navegadores usam sem instalar. | matriz de verificação | M |
| RNF-017 | Integridade da sincronização: nenhum lançamento perdido ou duplicado, mesmo com a rede cortada no meio do envio. | teste de falha de rede (100% verde) | M |

## 4. PWA e offline (ADR-0007)

Origem: pedido do cliente (versão web instalável e utilizável offline). Decisões em `docs/adr/0007-pwa-instalavel-e-offline-first.md`.

| ID | Requisito | Critério de aceite (resumo) | Pri. |
|---|---|---|---|
| RF-070 | App instalável: botão "Instalar o app" (Chrome/Edge) e instruções para iOS. | Dado navegador compatível, quando toco em Instalar, então abre em janela própria com ícone. | M |
| RF-071 | Abrir e navegar sem conexão após a primeira visita online. | Dado app já aberto uma vez, sem internet, então abre e mostra as telas. | M |
| RF-072 | Simulador de recria, compra e venda (cálculos) e dados já sincronizados funcionam offline. | Resultado offline = resultado de ouro. | M |
| RF-073 | Criar, editar e excluir lotes e cenários offline; ficam numa fila local. | Sem internet, lanço um lote e ele aparece como "pendente". | M |
| RF-074 | Sincronização automática ao reconectar (idempotente, em ordem, com repetição) e botão "Sincronizar agora". | Pendentes sobem sem duplicar; reenviar não cria cópia. | M |
| RF-075 | Indicador global (Sincronizado · Sem conexão · N pendentes · Erro) e selo "pendente" por registro, conforme `AppOffline`/`WebEstados`. | Estado visível em todas as telas. | M |
| RF-076 | Conflito entre aparelhos nunca sobrescreve em silêncio: pergunta "Manter o meu / Usar o do servidor". | Edição com versão desatualizada abre a decisão. | M |
| RF-077 | Atualização do app: aviso "Nova versão disponível" sem perder a fila nem interromper edição. | Fila preservada após atualizar. | M |
| RF-078 | Sair da conta com pendências avisa antes; logout/troca de usuário apaga dados locais. | Dados do usuário A não aparecem ao usuário B no mesmo aparelho. | M |
| RF-079 | Item rejeitado pelo servidor (validação) vai para "precisa de atenção" com motivo; nunca é descartado em silêncio. | Dado lançamento inválido, então aparece com o erro e permite corrigir/excluir. | M |
| RF-080 | Sessão expirada offline: continua local; ao reconectar pede login e retoma a fila. | Fila intacta após novo login. | M |

Limites offline (documentados na UI): cadastro, login, Google, recuperação de senha, importar planilha e primeiro acesso exigem internet.
