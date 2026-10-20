# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e1-layout.spec.ts >> RF-024/RF-040 Negócios e Painel cabem em todas as larguras e os botões são contextuais
- Location: apps\web\e2e\e1-layout.spec.ts:41:1

# Error details

```
Test timeout of 90000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - link "Pular para o conteúdo" [ref=e3] [cursor=pointer]:
      - /url: "#conteudo"
    - generic [ref=e4]:
      - main [ref=e5]:
        - generic [ref=e6]:
          - generic [ref=e7]:
            - heading "Compra e Venda" [level=1] [ref=e8]
            - paragraph [ref=e9]: Todos os lotes comprados e vendidos, com o saldo do giro.
          - button "Exportar" [ref=e11] [cursor=pointer]
        - group "Resumo do saldo" [ref=e14]:
          - generic [ref=e15]:
            - generic [ref=e16]:
              - text: Saldo
              - 'button "O que é: Saldo" [ref=e17] [cursor=pointer]':
                - generic [aria-hidden] [ref=e18]: i
            - generic [ref=e19]: −R$ 19.133,33
          - generic [ref=e20]:
            - generic [ref=e21]:
              - text: Comprado
              - 'button "O que é: Comprado" [ref=e22] [cursor=pointer]':
                - generic [aria-hidden] [ref=e23]: i
            - generic [ref=e24]: R$ 96.133
          - generic [ref=e25]:
            - generic [ref=e26]:
              - text: Vendido
              - 'button "O que é: Vendido" [ref=e27] [cursor=pointer]':
                - generic [aria-hidden] [ref=e28]: i
            - generic [ref=e29]: R$ 77.000
        - generic [ref=e30]:
          - tablist "Tipo de lançamento" [ref=e31]:
            - tab "Todas" [selected] [ref=e32] [cursor=pointer]
            - tab "Compras" [ref=e33] [cursor=pointer]
            - tab "Vendas" [ref=e34] [cursor=pointer]
          - generic [ref=e35]:
            - button "Nova compra" [ref=e36] [cursor=pointer]
            - button "Nova venda" [active] [ref=e39] [cursor=pointer]
        - generic [ref=e42]: 4 lançamentos · 2 compras · 2 vendas
        - generic [ref=e45]:
          - generic [ref=e46]:
            - generic [ref=e47]: VENDA
            - generic [ref=e48]:
              - generic [ref=e49]: Lote 2 · Novilhas
              - generic [ref=e50]: 10 cab. · 96,67 @ · R$ 300/@ · 04/10/2026
              - generic [ref=e51]: 2.900 kg líq. de 3.000 kg · peso vivo · desc. 10 kg/cab.
            - generic [ref=e52]:
              - generic [ref=e53]: R$ 29.000,00
              - generic [ref=e54]:
                - button "Editar lote 2 de venda" [ref=e55] [cursor=pointer]
                - button "Excluir lote 2 de venda" [ref=e58] [cursor=pointer]
          - generic [ref=e61]:
            - generic [ref=e62]: VENDA
            - generic [ref=e63]:
              - generic [ref=e64]: Lote 1 · Bois
              - generic [ref=e65]: 10 cab. · 150,00 @ · R$ 320/@ · 03/10/2026
              - generic [ref=e66]: 4.500 kg líq. de 4.500 kg · peso vivo · sem desconto
            - generic [ref=e67]:
              - generic [ref=e68]: R$ 48.000,00
              - generic [ref=e69]:
                - button "Editar lote 1 de venda" [ref=e70] [cursor=pointer]
                - button "Excluir lote 1 de venda" [ref=e73] [cursor=pointer]
          - generic [ref=e76]:
            - generic [ref=e77]: COMPRA
            - generic [ref=e78]:
              - generic [ref=e79]: Lote 2 · Garrotes
              - generic [ref=e80]: 20 cab. · 213,33 @ · R$ 310/@ · 02/10/2026
              - generic [ref=e81]: 6.400 kg
            - generic [ref=e82]:
              - generic [ref=e83]: R$ 66.133,33
              - generic [ref=e84]:
                - button "Editar lote 2 de compra" [ref=e85] [cursor=pointer]
                - button "Excluir lote 2 de compra" [ref=e88] [cursor=pointer]
          - generic [ref=e91]:
            - generic [ref=e92]: COMPRA
            - generic [ref=e93]:
              - generic [ref=e94]: Lote 1 · Bezerros
              - generic [ref=e95]: 10 cab. · 100,00 @ · R$ 300/@ · 01/10/2026
              - generic [ref=e96]: 3.000 kg
            - generic [ref=e97]:
              - generic [ref=e98]: R$ 30.000,00
              - generic [ref=e99]:
                - button "Editar lote 1 de compra" [ref=e100] [cursor=pointer]
                - button "Excluir lote 1 de compra" [ref=e103] [cursor=pointer]
      - navigation "Principal" [ref=e106]:
        - link [ref=e107] [cursor=pointer]:
          - /url: /painel
        - link [ref=e111] [cursor=pointer]:
          - /url: /negocios
        - link [ref=e115] [cursor=pointer]:
          - /url: /recria
        - link [ref=e120] [cursor=pointer]:
          - /url: /conta
  - status [ref=e125]
  - button "Open Next.js Dev Tools" [ref=e131] [cursor=pointer]
  - alert [ref=e135]
```