# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e1-jornadas.spec.ts >> E1 em 390px >> RF-024 cadastrar compra e venda leva ao saldo (390px)
- Location: apps\web\e2e\e1-jornadas.spec.ts:31:5

# Error details

```
Test timeout of 90000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - generic [ref=f1e2]:
    - link "Pular para o conteúdo" [ref=f1e3] [cursor=pointer]:
      - /url: "#conteudo"
    - generic [ref=f1e4]:
      - main [ref=f1e5]:
        - generic [ref=f1e6]:
          - generic [ref=f1e7]:
            - heading "Compra e Venda" [level=1] [ref=f1e8]
            - paragraph [ref=f1e9]: Todos os lotes comprados e vendidos, com o saldo do giro.
          - button "Exportar" [ref=f1e11] [cursor=pointer]
        - group "Resumo do saldo" [ref=f1e14]:
          - generic [ref=f1e15]:
            - generic [ref=f1e16]:
              - text: Saldo
              - 'button "O que é: Saldo" [ref=f1e17] [cursor=pointer]':
                - generic [aria-hidden] [ref=f1e18]: i
            - generic [ref=f1e19]: +R$ 18.000,00
          - generic [ref=f1e20]:
            - generic [ref=f1e21]:
              - text: Comprado
              - 'button "O que é: Comprado" [ref=f1e22] [cursor=pointer]':
                - generic [aria-hidden] [ref=f1e23]: i
            - generic [ref=f1e24]: R$ 30.000
          - generic [ref=f1e25]:
            - generic [ref=f1e26]:
              - text: Vendido
              - 'button "O que é: Vendido" [ref=f1e27] [cursor=pointer]':
                - generic [aria-hidden] [ref=f1e28]: i
            - generic [ref=f1e29]: R$ 48.000
        - generic [ref=f1e30]:
          - tablist "Tipo de lançamento" [ref=f1e31]:
            - tab "Todas" [selected] [ref=f1e32] [cursor=pointer]
            - tab "Compras" [ref=f1e33] [cursor=pointer]
            - tab "Vendas" [ref=f1e34] [cursor=pointer]
          - generic [ref=f1e35]:
            - button "Nova compra" [ref=f1e36] [cursor=pointer]
            - button "Nova venda" [ref=f1e39] [cursor=pointer]
        - generic [ref=f1e42]: 2 lançamentos · 1 compra · 1 venda
        - generic [ref=f1e45]:
          - generic [ref=f1e46]:
            - generic [ref=f1e47]: COMPRA
            - generic [ref=f1e48]:
              - generic [ref=f1e49]: Lote 1 · Bezerros
              - generic [ref=f1e50]: 10 cab. · 100,00 @ · R$ 300/@ · 19/10/2026
              - generic [ref=f1e51]: 3.000 kg
            - generic [ref=f1e52]:
              - generic [ref=f1e53]: R$ 30.000,00
              - generic [ref=f1e54]:
                - button "Editar lote 1 de compra" [ref=f1e55] [cursor=pointer]
                - button "Excluir lote 1 de compra" [ref=f1e58] [cursor=pointer]
          - generic [ref=f1e61]:
            - generic [ref=f1e62]: VENDA
            - generic [ref=f1e63]:
              - generic [ref=f1e64]: Lote 1 · Bois
              - generic [ref=f1e65]: 10 cab. · 150,00 @ · R$ 320/@ · 19/10/2026
              - generic [ref=f1e66]: 4.500 kg líq. de 4.500 kg · peso vivo · sem desconto
            - generic [ref=f1e67]:
              - generic [ref=f1e68]: R$ 48.000,00
              - generic [ref=f1e69]:
                - button "Editar lote 1 de venda" [ref=f1e70] [cursor=pointer]
                - button "Excluir lote 1 de venda" [ref=f1e73] [cursor=pointer]
      - navigation "Principal" [ref=f1e76]:
        - link [ref=f1e77] [cursor=pointer]:
          - /url: /painel
        - link [ref=f1e81] [cursor=pointer]:
          - /url: /negocios
        - link [ref=f1e85] [cursor=pointer]:
          - /url: /recria
        - link [ref=f1e90] [cursor=pointer]:
          - /url: /conta
  - status [ref=f1e95]
  - button "Open Next.js Dev Tools" [ref=f1e101] [cursor=pointer]
  - alert [ref=f1e105]
```