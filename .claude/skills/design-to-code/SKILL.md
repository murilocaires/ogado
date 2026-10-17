---
name: design-to-code
description: Converte as telas em references/design (.dc.html) em componentes Next.js fiéis, com tokens, estados e acessibilidade. Use em tickets de UI.
---

# Do design ao código

1. Mapeie a tela: `references/design/README.md` lista cada `.dc.html`, a rota alvo e os componentes. Leia o `.dc.html` como **código-fonte de layout** (não abre sozinho no navegador: depende do runtime do canvas).
2. Tokens: `references/design/TOKENS.md` (cores, tipografia Bricolage Grotesque + Geist, raios, sombras, `tabular-nums`). Gere `tokens.css` uma vez; consuma por variáveis CSS.
3. Componentes primitivos primeiro (Campo, CampoCalculado, Botão, Cartão, Segmentado, Tabela, Barra de navegação), depois telas.
4. Campo branco = entrada; menta + cadeado = calculado. Totais com `aria-live="polite"`.
5. Estados obrigatórios por tela (ver `WebEstados`/`App*` de estado): carregando, vazio, erro, offline, confirmação destrutiva.
6. Responsivo: o menu lateral vira barra inferior em tela estreita (reproduza a regra do design web).
7. Verifique visualmente com Playwright (screenshot desktop 1440 e mobile 390) e compare com o design; ajuste até ficar fiel.
