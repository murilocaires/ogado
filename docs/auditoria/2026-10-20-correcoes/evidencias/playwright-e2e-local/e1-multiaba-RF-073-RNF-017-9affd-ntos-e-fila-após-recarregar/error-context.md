# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e1-multiaba.spec.ts >> RF-073/RNF-017 duas abas preservam lançamentos e fila após recarregar
- Location: e2e\e1-multiaba.spec.ts:15:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('NOVILHAS', { exact: true }).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('NOVILHAS', { exact: true }).first() with timeout 15000ms
  - waiting for getByText('NOVILHAS', { exact: true }).first()

```

```yaml
- link "Pular para o conteúdo":
  - /url: "#conteudo"
- complementary:
  - text: O Gado
  - navigation "Principal":
    - link "Painel":
      - /url: /painel
    - link "Negócios":
      - /url: /negocios
    - link "Recria":
      - /url: /recria
    - link "Conta":
      - /url: /conta
  - text: Cada arroba na ponta do lápis.
  - link "Entrar para guardar na nuvem":
    - /url: /entrar
- main:
  - heading "Compra e Venda" [level=1]
  - paragraph: Todos os lotes comprados e vendidos, com o saldo do giro.
  - button "Exportar"
  - group "Resumo do saldo":
    - text: Saldo
    - 'button "O que é: Saldo"'
    - text: −R$ 60.000,00 Comprado
    - 'button "O que é: Comprado"'
    - text: R$ 60.000 Vendido
    - 'button "O que é: Vendido"'
    - text: R$ 0
  - tablist "Tipo de lançamento":
    - tab "Todas" [selected]
    - tab "Compras"
    - tab "Vendas"
  - button "Nova compra"
  - button "Nova venda"
  - text: 2 lançamentos · 2 compras · 0 vendas
  - table:
    - rowgroup:
      - 'row "Lote Cab. Peso (kg) @ O que é: Arrobas (compra) R$/@ Total O que é: Total do lote R$/cab. O que é: Valor por cabeça Ações"':
        - columnheader "Lote"
        - columnheader "Cab."
        - columnheader "Peso (kg)"
        - 'columnheader "@ O que é: Arrobas (compra)"':
          - text: "@"
          - 'button "O que é: Arrobas (compra)"'
        - columnheader "R$/@"
        - 'columnheader "Total O que é: Total do lote"':
          - text: Total
          - 'button "O que é: Total do lote"'
        - 'columnheader "R$/cab. O que é: Valor por cabeça"':
          - text: R$/cab.
          - 'button "O que é: Valor por cabeça"'
        - columnheader "Ações"
    - rowgroup:
      - row "COMPRA Lote 1 Garrotes · 20/10/2026 10 3.000 100,00 R$ 300,00 R$ 30.000,00 R$ 3.000,00 Editar lote 1 de compra Excluir lote 1 de compra":
        - cell "COMPRA Lote 1 Garrotes · 20/10/2026"
        - cell "10"
        - cell "3.000"
        - cell "100,00"
        - cell "R$ 300,00"
        - cell "R$ 30.000,00"
        - cell "R$ 3.000,00"
        - cell "Editar lote 1 de compra Excluir lote 1 de compra":
          - button "Editar lote 1 de compra"
          - button "Excluir lote 1 de compra"
      - row "COMPRA Lote 2 Novilhas · 20/10/2026 10 3.000 100,00 R$ 300,00 R$ 30.000,00 R$ 3.000,00 Editar lote 2 de compra Excluir lote 2 de compra":
        - cell "COMPRA Lote 2 Novilhas · 20/10/2026"
        - cell "10"
        - cell "3.000"
        - cell "100,00"
        - cell "R$ 300,00"
        - cell "R$ 30.000,00"
        - cell "R$ 3.000,00"
        - cell "Editar lote 2 de compra Excluir lote 2 de compra":
          - button "Editar lote 2 de compra"
          - button "Excluir lote 2 de compra"
- status
- alert
```

# Test source

```ts
  1  | import { expect, test, type Page } from '@playwright/test';
  2  | 
  3  | async function salvar(page: Page, categoria: string) {
  4  |   await page.getByRole('button', { name: 'Nova compra', exact: true }).first().click();
  5  |   const modal = page.getByRole('dialog', { name: 'Nova compra' });
  6  |   await modal.getByLabel('Categoria', { exact: true }).fill(categoria);
  7  |   await modal.getByLabel('Quantidade', { exact: true }).fill('10');
  8  |   await modal.getByLabel('Peso total do lote', { exact: true }).fill('3000');
  9  |   await modal.getByLabel('Preço da arroba', { exact: true }).fill('300');
  10 |   await modal.getByRole('button', { name: 'Salvar lote' }).click();
  11 |   await page.getByRole('alertdialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  12 |   await expect(page.getByRole('dialog', { name: 'Nova compra' })).toHaveCount(0);
  13 | }
  14 | 
  15 | test('RF-073/RNF-017 duas abas preservam lançamentos e fila após recarregar', async ({
  16 |   page,
  17 |   context,
  18 | }) => {
  19 |   await page.goto('/negocios');
  20 |   const outra = await context.newPage();
  21 |   await outra.goto('/negocios');
  22 |   await expect(page.getByRole('heading', { name: 'Nenhum lote' })).toBeVisible();
  23 |   await expect(outra.getByRole('heading', { name: 'Nenhum lote' })).toBeVisible();
  24 |   await salvar(page, 'GARROTES');
  25 |   await salvar(outra, 'NOVILHAS');
> 26 |   await expect(page.getByText('NOVILHAS', { exact: true }).first()).toBeVisible();
     |                                                                     ^ Error: expect(locator).toBeVisible() failed
  27 |   await expect(outra.getByText('GARROTES', { exact: true }).first()).toBeVisible();
  28 |   await page.reload();
  29 |   await outra.reload();
  30 |   for (const aba of [page, outra]) {
  31 |     await expect(aba.getByText('GARROTES', { exact: true }).first()).toBeVisible();
  32 |     await expect(aba.getByText('NOVILHAS', { exact: true }).first()).toBeVisible();
  33 |   }
  34 | });
  35 | 
```