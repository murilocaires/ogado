# Bovaro — Requisitos (v1 web)

> **Revisão de 2026-10-18 (ADR-0012):** o protótipo legado passou a ser a referência de comportamento e UX. Itens alterados ou novos: RN-002, RN-009, RN-019, RN-021, RN-023, RN-024…RN-027, RF-004…RF-007, RF-011, RF-020…RF-026, RF-030…RF-036, RF-040, RF-052, RF-053, RNF-009. Pontos que dependem de decisão humana estão em "Em aberto" no ADR-0012 (Q-A…Q-G).

Legenda de prioridade: **M** = must (v1) · **S** = should (v1.1) · **C** = could/futuro. Todo ID abaixo deve ter ao menos um teste com o ID no nome (`node scripts/trace-check.mjs`). Critérios no formato Dado/Quando/Então.

## 1. Regras de negócio (RN) — paridade com as planilhas

| ID | Regra | Origem | Pri. |
|---|---|---|---|
| RN-001 | Na compra, 1 @ = 30 kg de peso vivo. | Compra e Venda `F4` | M |
| RN-002 | **Revisada (ADR-0012, ajustada pelo ADR-0013):** na venda, @ = kg líquido ÷ kg por @, onde kg líquido = kg − qtd × desconto (kg/cab., RN-025) e kg por @ depende da base do lote (RN-024). Com base carcaça e 10 kg/cab. é exatamente a fórmula da planilha: @ = (kg − qtd×10) ÷ 15 (`F11`). Se qtd × desconto > kg, o kg líquido é 0 (sem @ nem total negativos). | planilha + protótipo | M |
| RN-003 | Peso do lote em 3 modos: total informado, médio × qtd, ou individual (soma dos pesos). Vale para compra e venda. | `E5`; pedido do cliente | M |
| RN-004 | Compra: total = @ × R$/@; R$/cab. = total ÷ qtd (calculado em todas as linhas). | `H4`,`I5` | M |
| RN-005 | Venda: total = @ × R$/@. | `H11` | M |
| RN-006 | Saldo = total de vendas − total de compras. | `H19` | M |
| RN-007 | Recria: cabeças = investimento ÷ R$/cab. de compra, sem arredondar (exibe arredondado). | Recria `B21` | M |
| RN-008 | UA total = cab × peso inicial ÷ 450. | `B23` | M |
| RN-009 | **Lotação inicial (UA/ha) = lotação total em UA ÷ área pastável informada**, conforme decisão explícita de 20/10/2026 (ADR-0017). A simulação atual usa essa área inclusive ao abrir legado `fixa80`; área vazia/zero mostra indefinido. A regra altera apenas a densidade inicial, sem mudar custos/faturamento. Snapshots históricos permanecem imutáveis. A variante de 80 ha continua apenas no domínio para compatibilidade com a planilha original. | `B24`, corrigido pelo dono no app | M |
| RN-010 | Peso médio = (inicial + final) ÷ 2; lotação final = cab × peso médio ÷ 450 ÷ área. | `B26`,`B27` | M |
| RN-011 | @ produzidas (na venda) = peso final ÷ 30 × cab. | `B29` | M |
| RN-012 | Consumo de suplemento (kg/cab/dia) = peso médio × 0,3%; por dia do lote = × cab; custo total = × R$/kg × dias. | `F24`–`F27` | M |
| RN-013 | @ de carcaça/cab = peso final × 52% ÷ 15; venda/cab = @ × R$/@. | `J20`,`J21` | M |
| RN-014 | Imposto = venda/cab × 1,5% (por cab) e × cab (total). | `J23`,`J24` | M |
| RN-015 | Sanidade = dias ÷ 30 × cab × R$ 2,50. | `M20` | M |
| RN-016 | Custo operacional = suplemento + sanidade + imposto + frete + funcionário. | `B38` | M |
| RN-017 | Faturamento bruto (variante padrão `pesoVivo`, igual à planilha) = peso final ÷ 30 × cab × R$/@ de venda (`B29` × R$/@); variante `carcaca` (RN-023) = @ de carcaça/cab × cab × R$/@; **líquido = bruto − custo operacional − investimento**; total em caixa = investimento + líquido. | `E33`,`E35`,`E38` | M |
| RN-018 | Líquido/mês = líquido ÷ (dias ÷ 30); líquido/ha = líquido ÷ área. | `F33`,`F35` | M |
| RN-019 | GMD implícito = (peso final − inicial) ÷ dias (informativo; aparece em "Números do lote"). | derivado | M |
| RN-020 | Valores duplicados na planilha são um só campo no app (PA-03). | `F19-F21`,`B37` | M |
| RN-021 | Parâmetros padrão (30 kg, 15 kg, desconto de venda **10 kg/cab** (RN-025, ADR-0013), 450, 52%, 1,5%, 0,3%, R$ 2/kg, R$ 2,50) valem como fixos da planilha. O protótipo edita rendimento, imposto, consumo, proteinado e sanidade (dentro da simulação) e o desconto (no lote). **Decisão do dono (2026-10-19): não haverá tela de parâmetros editáveis por fazenda nem "restaurar padrão" (Q-D encerrada).** **Nota (ADR-0014, 2026-10-19): nenhum padrão é pré-preenchido no simulador da recria; ele começa em branco e o usuário informa todos os dados (o dono vai estudar a planilha). Os padrões seguem só no domínio/paridade.** | planilhas | M |
| RN-023 | Variantes de fórmula (ADR-0008, revisado pelo ADR-0012): `lotacaoInicial` = `fixa80`\|`areaPastavel` (escolhida na simulação); `faturamentoBruto` = `pesoVivo`\|`carcaca` (a variante `carcaca` **não está no protótipo**; adiada, Q-C). Padrão = planilha. A simulação salva guarda a variante usada e o resultado a exibe. | decisão do pecuarista | M |
| RN-022 | Divisão por zero / campo vazio não quebra a tela: resultado mostra "—" e dica de preenchimento (inclui R$/cab. com quantidade 0 em compra e venda). | UX | M |
| RN-024 | **Base do preço da @ na venda, por lote:** `vivo` (padrão) → 1 @ = `arrobaVivoKg` (30 kg); `carcaca` → 1 @ = `arrobaCarcacaKg` (15 kg). Compra é sempre peso vivo ÷ 30. | protótipo | M |
| RN-025 | **Desconto em kg por cabeça na venda, por lote (ADR-0013, decisão do dono 2026-10-19):** kg líquido = kg − qtd × desconto; padrão **10 kg/cab.**; opcional (desligado = 0 kg); o valor é editável por lote. Só existe na venda. Ligado automaticamente se a categoria for feminina (bezerra, novilha, vaca, fêmea, matriz, garrota) e desligado nas demais, até o usuário alterar a opção no lote. Se qtd × desconto > kg, o kg líquido é limitado a 0. O desconto **não** é percentual (reverte o ADR-0012). | planilha / ADR-0013 | M |
| RN-026 | Alertas não bloqueantes no resultado da recria: cabeças fracionárias ("compra X cab. ≈ Y; o cálculo usa o valor exato"), lotação inicial > 4 UA/ha, lotação final > 6 UA/ha, mais de 250 cabeças. Não impedem salvar nem calcular. | protótipo (antes v2/Metas) | M |
| RN-027 | Modos de peso (RN-003): só o modo ativo entra no cálculo; o que foi digitado nos outros modos fica guardado enquanto o lote está aberto e não se perde ao alternar. O modo escolhido é gravado com o lote. | protótipo | M |

## 2. Requisitos funcionais (RF)

| ID | Requisito | Critério de aceite (resumo) | Pri. |
|---|---|---|---|
| RF-001 | Cadastro e login com e-mail/senha; entrada com Google. | Dado e-mail novo, quando cadastro, então conta criada e sessão iniciada. | M |
| RF-002 | Sessão segura, logout e recuperação de senha. | Senha reset por link expirável. | M |
| RF-003 | Primeiros passos: nome da fazenda, área pastável, confirmação dos parâmetros. **Adiado/opcional pela Q-D do ADR-0012**; o login leva direto ao painel e a fazenda é preenchida em Conta. Não equivale a funcionalidade entregue. | Se implementado futuramente, fluxo de 3 passos conclui e leva ao painel. | S |
| RF-004 | Conta · Perfil: editar nome e e-mail com salvamento direto, sem confirmação adicional; nome obrigatório, e-mail válido. | Dado nome vazio ou e-mail inválido, então avisa e não salva. | M |
| RF-005 | Conta · Senha: definir (conta sem senha) ou alterar (exige a senha atual); nova senha + confirmação iguais. Regras de senha do ADR-0010 (o protótipo só pede 8 caracteres; Q-F). | Dado senha atual errada ou confirmação diferente, então avisa e não altera. | M |
| RF-006 | Conta · Google: vincular e desvincular; **não permite desvincular sem senha definida**. Selos "Senha definida" / "Google vinculado" no cabeçalho da Conta. | Dado conta só com Google, quando desvincula, então pede para definir senha antes. | M |
| RF-007 | Conta · Apagar minha conta: remove perfil, fazenda, lotes e cenários de forma permanente; só habilita o botão depois de digitar "deletar". | Dado texto diferente de "deletar", então o botão fica desabilitado. | M |
| RF-010 | Uma conta pode ter uma fazenda (v1); dados isolados por fazenda. | Usuário A nunca lê dados da fazenda B. | M |
| RF-011 | Configurações da fazenda: nome e área (no protótipo, em **Conta · Fazenda**, agora com salvamento direto). **Decisão do dono (2026-10-19): a área da fazenda NÃO preenche a "Área pastável" do simulador; parâmetros de cálculo e variantes ficam fixos, sem tela de edição.** | Alteração reflete nos novos cálculos; cenários salvos não mudam. | M |
| RF-020 | CRUD de lotes de **compra** (número do lote sequencial, categoria, qtd, modo de peso, R$/@, data). | Cria, edita, exclui (com confirmação). | M |
| RF-021 | CRUD de lotes de **venda** (inclui base da @ e desconto em kg por cabeça, RN-024/025). | idem | M |
| RF-022 | Modo de peso individual: lista de pesos animal a animal (um por linha, `;` ou vírgula seguida de espaço); qtd = nº de pesos; peso = soma; mostra os pesos como etiquetas. | Colar lista, editar, remover pesos. | M |
| RF-023 | Resumo: cabeças, @, total por aba, **saldo** com sinal e cor; faixa Saldo · Comprado · Vendido no topo. | Bate com o exemplo de ouro revisado (RN-002, Q-A). | M |
| RF-024 | Tela **Negócios** unificada: abas Todas · Compras · Vendas; "Todas" ordena por data decrescente (sem data por último) com etiqueta COMPRA/VENDA; tabela (Lote, Cab., Peso, @, R$/@, Total, R$/cab.) no desktop e cartões no celular; resumo da aba (cab. · @ · total). | Dado lançamentos de compra e venda, quando abro "Todas", então vejo ambos intercalados por data. | M |
| RF-025 | Modal de lote: alternância Compra/Venda apenas em lote novo; categoria em texto livre com sugestões (BEZERROS, BEZERRAS, GARROTES, NOVILHAS, BOIS, VACAS), gravada em maiúsculas; pré-visualização calculada (cabeças, @, total) em campos menta + cadeado; salva diretamente, sem confirmação adicional; exige quantidade/peso e preço da @. | Dado preço vazio, então avisa "Informe o preço da arroba" e não salva. | M |
| RF-026 | Venda: escolher base da @ (peso vivo · carcaça) e aplicar/ajustar o desconto do lote em kg por cabeça; dica "em vendas de fêmeas é comum descontar 10 kg por cabeça" na aba Vendas. | Dado categoria "NOVILHAS" em lote novo, então o desconto de 10 kg/cab. vem ligado. | M |
| RF-030 | Simulador de recria com todos os campos de entrada da planilha, agrupados (Lote e área · Suplemento · Imposto e sanidade · Outros custos); recalcula ao digitar. **Abre em branco (ADR-0014): sem "Restaurar padrões"; "Limpar campos" permanece.** Variante atual da interface: cabeças inteiras, arredondadas para cima; cenários preservam a variante e a versão do cálculo (ADR-0015). | Simulador novo mostra "—". Ouro fracionário do domínio permanece R$ 102.408,05; mesmas entradas na variante atual da interface dão R$ 103.307,60. Reabrir um cenário reproduz sua variante original. | M |
| RF-031 | Resultado completo: faturamento líquido (destaque) com por mês, por ha e total em caixa; custo operacional com barra de composição e % de cada item; "Da venda ao líquido" (bruto − custo − investimento); "Números do lote" (cabeças, lotação total/inicial/final, peso médio, GMD, @ vendidas, @ de carcaça/cab., consumo/cab., venda/cab.); alertas RN-026. | Valores e rótulos corretos (PA-02). | M |
| RF-032 | Salvar a simulação como **cenário**: nome livre (padrão "Cenário N") + data (sem campo de ano safra; o ano safra vai no nome, Q-G); duplicar ("… (cópia)"), renomear, excluir (com confirmação). | Lista de cenários com data; após gravar com sucesso, limpa o simulador sem alterar o snapshot salvo. | M |
| RF-033 | Comparar **2 a 3 cenários** lado a lado (marcar nas caixas; barra "N selecionados · Comparar · Limpar"): indicadores com diferença em relação ao primeiro marcado, verde = melhor, vermelho = pior. Promovido de S/v1.1 (ADR-0012). | Dado 3 marcados, quando marco o 4º, então avisa "Compare até 3 cenários". | M |
| RF-034 | Cenários: busca por nome, ordenação (mais recentes · maior líquido · nome A–Z) e visão em lista ou grade; estados "Nenhum cenário salvo" e "Nada encontrado". | Dado busca sem resultado, então mostra "Nada encontrado". | M |
| RF-035 | Cenários: "Abrir no simulador" carrega as entradas do cenário no simulador (substitui as atuais). | Entradas do simulador = entradas do cenário. | M |
| RF-036 | ★ marca o cenário de maior faturamento líquido na lista e na comparação (só com 2+ cenários). | Dado 2 cenários, então o de maior líquido tem ★. | M |
| RF-040 | Painel: saudação com nome da pessoa e da fazenda; saldo (Comprado/Vendido); cartão "Recria · simulação atual" (líquido, por mês, por ha); atalhos (nova compra, nova venda, simular recria); **últimas 6 operações** por data decrescente. | Reflete dados reais; conta nova mostra "Nenhuma operação ainda" + "Cadastrar primeiro lote". | M |
| RF-041 | Exportar compras/vendas/simulações em CSV (e XLSX). | Arquivo abre no Excel com pt-BR. | S |
| RF-042 | Importar planilha Excel no formato do curso. | Pré-visualiza e confirma antes de gravar. | S |
| RF-050 | Estados: carregando, vazio, erro, offline, sucesso, confirmação destrutiva em todas as telas. | Conforme `WebEstados` (offline detalhado em RF-070…RF-080). | M |
| RF-051 | Campo calculado é somente leitura e visualmente distinto (menta + cadeado). | Não aceita digitação. | M |
| RF-052 | **Ajuda contextual:** botão "i" ao lado de cada indicador calculado (saldo, comprado, vendido, @, total, R$/cab., líquido, por mês, por ha, caixa, custos, lotação, GMD…) abre um balão com nome, explicação em linguagem simples e "Como é calculado". Fecha com Esc, clique fora, rolagem ou nova navegação; `aria-label` "O que é: …" e `aria-expanded`. | Dado foco no "i" e Enter, então o balão abre; Esc fecha. | M |
| RF-053 | Navegação principal com 4 itens — Painel · Negócios · Recria · Conta —, lateral no desktop e barra inferior abaixo de 900 px; item ativo com `aria-current`. Substitui a rota "Configurações" do design. | Em 390 px a barra inferior aparece e a lateral some. | M |
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
| RNF-007 | Idioma pt-BR, moeda BRL, números `1.234,56`. Em campo de formulário só a vírgula é decimal; ponto só vale como milhar com vírgula decimal ou com 2+ grupos de 3 dígitos; `1.500`/`1.5` são rejeitados com dica para usar vírgula. | testes de formatação | M |
| RNF-008 | Observabilidade: logs estruturados, id de requisição, erros sem PII. | revisão | S |
| RNF-009 | LGPD: consentimento e exportação dos dados do titular. (A **exclusão de conta** virou requisito funcional RF-007, M.) | fluxo mínimo | S |
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
| RF-075 | Indicador global discreto sem conexão; sincronização automática, sem selo "pendente" por registro. Mostrar "precisa de atenção" somente quando houver intervenção necessária. | Itens aguardando envio não exibem selo; falhas acionáveis continuam visíveis. | M |
| RF-076 | Conflitos de lotes/cenários são resolvidos automaticamente pela política já implementada em `d36a844` e `docs/sincronizacao-automatica.md`: mescla por campo sobre a última base confirmada; exclusão prevalece; mesmo campo usa último envio aceito; versões concorrentes são arquivadas antes de substituir. Não há escolha manual na interface. | Campos independentes são preservados; conflito 409 refaz a mesclagem; falha ao arquivar mantém pendente; exclusão não é ressuscitada; histórico autenticado permite recuperação explícita. | M |
| RF-077 | Atualização do app **silenciosa** (ADR-0014, substitui o aviso "Nova versão disponível"): o service worker novo assume sozinho e a página recarrega só em momento seguro (sem diálogo aberto, sem campo digitado em foco), sem laço de recarga, sem perder a fila. | Fila preservada após atualizar; sem banner nem toast. | M |
| RF-078 | Sair da conta com pendências avisa antes; logout/troca de usuário apaga dados locais. | Dados do usuário A não aparecem ao usuário B no mesmo aparelho. | M |
| RF-079 | Item rejeitado pelo servidor (validação) vai para "precisa de atenção" com motivo; nunca é descartado em silêncio. | Dado lançamento inválido, então aparece com o erro e permite corrigir/excluir. | M |
| RF-080 | Sessão expirada offline: continua local; ao reconectar pede login e retoma a fila. | Fila intacta após novo login. | M |

Limites offline (documentados na UI): cadastro, login, Google, recuperação de senha, importar planilha e primeiro acesso exigem internet.
