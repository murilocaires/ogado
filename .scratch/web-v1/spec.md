Status: aguardando-aprovacao-humana
Label: ready-for-agent (aplicar somente após aprovação)

# Spec — O Gado Web v1 (instalável, offline-first)

IDs de requisitos: `docs/negocio/02-requisitos.md` (RN/RF/RNF). Decisões: ADR-0002…0008.

## Problem Statement

O pecuarista calcula compra, venda e recria em planilhas frágeis: uma fórmula quebrada estraga a conta, não há histórico e nada funciona bem no curral, onde o sinal falha. Ele precisa de um lugar confiável, com os mesmos números do curso, que abra no celular como um aplicativo e deixe lançar sem internet.

## Solution

Uma aplicação web **instalável (PWA) e offline-first**, com uma fazenda por conta:

- **Compra e Venda** de lotes com 3 modos de peso (total, médio, animal a animal) e saldo.
- **Simulador de Recria** que recalcula ao digitar, com resultado detalhado e cenários salvos por ano safra.
- **Painel** com saldo, últimas operações e resumo da recria.
- Cálculos idênticos aos da planilha (paridade ≤ 1e-6). Onde o curso e a planilha divergem, o padrão é a planilha e o usuário escolhe a variante nas configurações da fazenda (lotação inicial; faturamento bruto).
- Tudo funciona sem internet depois do primeiro acesso: lançamentos entram numa fila local e sobem ao reconectar; conflitos entre aparelhos sempre perguntam.

## User Stories

1. Como pecuarista, quero criar minha conta com e-mail e senha ou com Google, para começar a usar.
2. Como pecuarista, quero recuperar a senha por um link que expira, para não perder o acesso.
3. Como pecuarista, quero sair da conta e saber se há lançamentos não enviados, para não perder nada.
4. Como novo usuário, quero um passo a passo (nome da fazenda, área pastável, parâmetros), para chegar ao painel configurado.
5. Como pecuarista, quero editar nome, área e parâmetros de cálculo e restaurar o padrão da planilha, para ajustar à minha realidade.
6. Como pecuarista, quero escolher a variante da lotação inicial (80 ha da planilha ou área pastável), para comparar com minha realidade sem perder a paridade.
7. Como pecuarista, quero escolher se o faturamento bruto usa peso vivo (planilha) ou carcaça, para refletir como vendo.
8. Como pecuarista, quero que cenários salvos mantenham a variante que usei, para que mudar a configuração não altere o passado.
9. Como pecuarista, quero ver qual variante está ativa no resultado, para não me confundir.
10. Como pecuarista, quero cadastrar um lote de compra (categoria, quantidade, peso, R$/@, data), para registrar o que comprei.
11. Como pecuarista, quero informar o peso como total, médio ou animal a animal, para registrar do jeito que pesei.
12. Como pecuarista, quero colar uma lista de pesos individuais, editar e remover pesos, para não digitar um a um.
13. Como pecuarista, quero ver total e R$/cabeça calculados em todas as linhas, para conferir o negócio.
14. Como pecuarista, quero cadastrar, editar e excluir (com confirmação) lotes de venda, para manter o histórico.
15. Como pecuarista, quero ver cabeças, @ e total por aba e o saldo com sinal e cor, para saber meu giro.
16. Como pecuarista, quero simular a recria alterando investimento, dias, pesos e preços, para decidir se compensa comprar.
17. Como pecuarista, quero o resultado completo (custos em composição, bruto, líquido, caixa, por mês e por hectare), para entender de onde vem o lucro.
18. Como pecuarista, quero campos calculados somente leitura (menta + cadeado), para não estragar a conta.
19. Como pecuarista, quero que campo vazio ou divisão por zero mostre "—" e uma dica, para a tela não quebrar.
20. Como pecuarista, quero ver aviso "≈ 60 cab." quando o cálculo der cabeças fracionárias, para entender o arredondamento.
21. Como pecuarista, quero salvar, duplicar e renomear simulações por ano safra, para organizar cenários.
22. Como pecuarista, quero um painel com saldo, últimas operações e atalhos, para ver tudo ao abrir.
23. Como pecuarista, quero exportar compras, vendas e simulações em CSV (e XLSX) que abram no Excel em pt-BR, para levar os dados comigo (desejável).
24. Como pecuarista, quero instalar o app no celular ou no computador, para abri-lo como um aplicativo.
25. Como usuário de iPhone, quero instruções claras de "Adicionar à Tela de Início", para instalar mesmo sem botão.
26. Como pecuarista, quero abrir e navegar sem internet depois da primeira visita, para usar no curral.
27. Como pecuarista, quero lançar, editar e excluir lotes e cenários offline, para não depender de sinal.
28. Como pecuarista, quero ver o que está pendente e o estado geral (Sincronizado, Sem conexão, N pendentes, Erro), para confiar que nada se perdeu.
29. Como pecuarista, quero que tudo suba sozinho ao reconectar, sem duplicar, e poder tocar em "Sincronizar agora", para ter controle.
30. Como pecuarista com dois aparelhos, quero ser perguntado entre "Manter o meu" e "Usar o do servidor" quando o mesmo registro mudou nos dois, para nunca perder dados em silêncio.
31. Como pecuarista, quero que lançamentos rejeitados pelo servidor apareçam como "precisa de atenção" com o motivo, para corrigir ou excluir.
32. Como pecuarista, quero continuar usando offline se a sessão expirar e ser pedido o login ao reconectar sem perder a fila, para não perder o trabalho do dia.
33. Como pecuarista, quero ser avisado de nova versão sem perder a fila nem ser interrompido ao editar, para atualizar com segurança.
34. Como dono da fazenda, quero que ninguém de fora veja meus dados e que o dado de outro usuário não apareça no mesmo aparelho, para ter confiança.
35. Como pessoa com deficiência, quero teclado completo, contraste e alvos de toque ≥ 44 px, para usar sem barreiras.
36. Como pecuarista, quero estados claros de carregando, vazio, erro, sucesso e confirmação destrutiva em todas as telas, para saber o que está acontecendo.

## Implementation Decisions

- **Estrutura:** monorepo pnpm com web (Next.js App Router), API (Fastify), domínio, contratos (Zod) e banco (Prisma/PostgreSQL). A API é separada do Next para reuso pelo app móvel da v3. Regra de negócio só no domínio, que é puro e roda no cliente e no servidor.
- **Decimais:** `decimal.js` no domínio; entradas persistidas em Decimal; resultados derivados guardados como string decimal sem arredondar; no IndexedDB, sempre string (ADR-0003).
- **Variantes de fórmula (ADR-0008, RN-023):** `lotacaoInicial` (`fixa80` | `areaPastavel`) e `faturamentoBruto` (`pesoVivo` | `carcaca`), por fazenda, padrão = planilha; a simulação salva guarda a variante usada. Não há seletor dentro da simulação.
- **Bruto padrão:** peso final ÷ 30 × cab × R$/@ (corrige o texto antigo da RN-017). Lotação padrão: ÷ 80 ha (ADR-0004).
- **Tenancy:** uma fazenda por conta; toda consulta escopada por `fazendaId`; várias fazendas ficam para a v1.1.
- **Entidades sincronizáveis (ADR-0007):** `id` UUID gerado no cliente, `version`, `updatedAt`, `deletedAt`, `fazendaId`. Mutações carregam `mutationId` e são idempotentes. API de sincronização com envio (push) e recebimento incremental (pull por cursor `updatedSince`, incluindo exclusões lógicas).
- **Conflito:** versão base desatualizada gera conflito e pergunta ao usuário; exclusão x edição também pergunta; nunca "último vence".
- **Cliente:** telas usam uma interface de repositório. Primeiro sobre a API (T-06/T-07), depois local-first com IndexedDB e fila de envio (T-14). Service worker só guarda shell e estáticos; nunca respostas autenticadas.
- **Auth:** e-mail/senha (argon2id) + Google OAuth, sessão em cookie HttpOnly. Exige internet para entrar; sessão expirada offline não bloqueia o uso local. Biblioteca de auth e envio de e-mail: a decidir no ticket T-04 (ADR próprio).
- **Segurança no aparelho:** nada de senha ou token em IndexedDB/localStorage; logout apaga o banco local, avisando se há pendências.
- **UI:** fiel a `references/design`; campo branco = entrada, menta + cadeado = calculado; pt-BR, BRL, `1.234,56`; responsivo 360–1920 px; WCAG 2.2 AA.
- **Entrega:** tickets T-01…T-15 em `docs/sdd/tasks.md`; RF-041 (exportação) é desejável.

## Testing Decisions

- **Bom teste:** valida comportamento externo, tem o ID do requisito no nome, e o valor esperado vem de fonte independente (planilha/ouro), nunca da implementação.
- **Seams propostos (a confirmar no Passo 2):**
  1. Funções públicas de `packages/domain` — paridade com `tests/fixtures/golden.json` (tolerância 1e-6); variantes não padrão com valores calculados à mão, marcados `origem: "nao-planilha"` e revisados pelo humano.
  2. Rotas HTTP da API (inclui `/sync/*`) com Postgres real — isolamento multi-tenant, idempotência, conflitos, corte de rede no meio do envio.
  3. E2E Playwright: jornada "cadastrar compra e venda → saldo" e "simular recria → resultado", mais uma jornada offline (`setOffline`: lançar, reconectar, conferir sem duplicar). Lighthouse verifica instalabilidade.
- **Prior art:** `tests/fixtures/golden.json`, `references/calculo/verify.py` (32 checks, 0 falhas no Passo 0) e `scripts/trace-check.mjs`.
- Cobertura do domínio ≥ 95%; axe sem violações.

## Out of Scope

Cria completa, Metas e Fechamento da Recria, integração Google Sheets, app **nativo** móvel, equipe multiusuário, várias fazendas por conta, comparação de cenários (RF-033) e importação de planilha (RF-042) — v1.1; edição colaborativa em tempo real, push notifications, criptografia do banco local, login offline.

## Further Notes

- **Ainda em aberto** (não bloqueiam a spec): provedor de hospedagem e CI; biblioteca de auth e e-mail (reset de senha); direitos de uso do nome/conteúdo "O Pecuário".
- **Ambiente Windows:** `references/calculo/verify.py` falha como está (barras invertidas no caminho passado ao Node). `references/` é somente leitura; rodei uma cópia corrigida e o resultado foi 32/32. Decidir se o `pnpm test:parity` usa o oráculo apenas em CI Linux.
- Itens sem ticket a distribuir no Passo 2: RNF-002, RNF-007, RN-019, RN-020, RF-033/RF-042 (v1.1).
- Os diagramas e telas de offline vêm de `WebEstados` e `AppOffline`; o texto de ajuda do estado offline já existe no design.
