# Design de referência — O Gado

Origem: canvas "O Gado — Marca e Telas v1" (artefato: https://claude.ai/artifact/9Vp22JYTae6wMFxeRsBPAG). Os arquivos `*.dc.html` são **código-fonte de layout** do canvas e dependem do runtime `support.js` (não incluso); **não abrem sozinhos no navegador**. Leia-os para extrair estrutura, textos, estados e estilos; abra o artefato acima para ver as telas renderizadas. `canvas.json` lista as 21 pranchas e suas posições. `calc.js` está em `../calculo/`.

> Somente leitura. Para divergir do design, atualize a spec e registre ADR.

## Pranchas → rotas sugeridas

| Arquivo | Tela | Rota web / componente |
|---|---|---|
| `Main` | Marca (logo, tagline, aplicação) | `/` marketing opcional, favicon, `Logo` |
| `Sistema` | Sistema de design (tokens, componentes) | `styles/tokens.css`, `components/ui/*` |
| `Produto` | Mapa do produto (v1/v2/v3) | referência |
| `WebPainel` | Painel | `/painel` |
| `WebCompraVenda` | Compra e Venda (3 modos de peso, peso a peso) | `/negocios` |
| `WebRecria` | Cálculos Recria (simulador + resultado) | `/recria` |
| `WebConfig` | Configurações (fazenda, parâmetros) | `/configuracoes` |
| `WebLogin` | Entrar | `/entrar` |
| `WebPrimeirosPassos` | Onboarding | `/primeiros-passos` |
| `WebEstados` | Vazio, erro, offline, sucesso, exclusão | componentes de estado |
| `App*` (11) | Versão celular das mesmas telas | referência para o app (v3) |

Mapa app: Painel, Compra e Venda, Novo lote, Simular recria, Resultado, Boas-vindas, Entrar, Vazio, Sem conexão, Confirmar exclusão, Conta e ajustes.

## Regras de UX
- Campo **branco** = o usuário preenche. Campo **menta com cadeado** = calculado, somente leitura.
- Totais com `aria-live`; alvo de toque ≥ 44 px; foco visível.
- Navegação lateral (desktop) vira barra inferior em tela estreita.
- Tagline: *"Cada arroba na ponta do lápis."*

Tokens: veja `TOKENS.md` e `tokens.css`.
