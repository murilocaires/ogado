import { readFile } from 'node:fs/promises';
import { expect, test, type Download } from '@playwright/test';

/**
 * E6: exportação. RF-041 (CSV/XLSX gerados no navegador) e RNF-009 (JSON dos dados do titular,
 * vindo da API). Contra a API real + Postgres.
 */
const SENHA = 'Segredo#2026';
const HOJE = /\d{4}-\d{2}-\d{2}/;

async function conteudo(download: Download): Promise<Buffer> {
  const caminho = await download.path();
  return readFile(caminho);
}

test('RF-041 e RNF-009: lança um lote, baixa o CSV e o XLSX e baixa os dados da Conta', async ({
  page,
}) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  const email = `export-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.ogado.invalid`;

  await page.goto('/cadastrar');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByLabel('Confirmar senha', { exact: true }).fill(SENHA);
  await page.getByLabel(/Li e aceito/).check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/painel$/);

  await page.getByRole('link', { name: 'Negócios' }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Nova compra' }).first().click();
  const modal = page.getByRole('dialog', { name: 'Nova compra' });
  await modal.getByLabel('Categoria', { exact: true }).fill('Bezerros; "nelore"');
  await modal.getByLabel('Quantidade', { exact: true }).fill('10');
  await modal.getByLabel('Peso total do lote', { exact: true }).fill('3000');
  await modal.getByLabel('Preço da arroba', { exact: true }).fill('300');
  await modal.getByRole('button', { name: 'Salvar lote' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Lote salvo.' })).toBeVisible();

  // CSV de compras
  await page.getByRole('button', { name: 'Exportar' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Exportar compras e vendas' });
  await dialogo.getByRole('button', { name: 'Compras', exact: true }).click();
  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    dialogo.getByRole('button', { name: 'Exportar', exact: true }).click(),
  ]);
  expect(csv.suggestedFilename()).toMatch(new RegExp(`^ogado-compras-${HOJE.source}\\.csv$`));
  const bytes = await conteudo(csv);
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8
  const texto = bytes.toString('utf8').slice(1);
  const linhas = texto.split('\r\n');
  expect(linhas[0]).toBe(
    'Tipo;Lote;Data;Categoria;Modo de peso;Cabeças;Peso (kg);Base da @;Desconto (kg/cab.);kg líquido;Arrobas (@);Preço (R$/@);Total (R$);R$/cabeça',
  );
  // categoria com ; e aspas sai escapada; números com vírgula decimal
  expect(linhas[1]).toMatch(/^Compra;1;[^;]*;"Bezerros; ""nelore""";Peso total;10;3000,00;;;;/);
  expect(linhas[1]).toMatch(/;300,00;\d+,\d{2};\d+,\d{2}$/);
  await expect(
    page.getByRole('status').filter({ hasText: /Arquivo ogado-compras-.*\.csv baixado\./ }),
  ).toBeVisible();

  // XLSX de compras e vendas (duas abas)
  await page.getByRole('button', { name: 'Exportar' }).click();
  const dialogo2 = page.getByRole('dialog', { name: 'Exportar compras e vendas' });
  await dialogo2.getByRole('button', { name: 'XLSX', exact: true }).click();
  const [xlsx] = await Promise.all([
    page.waitForEvent('download'),
    dialogo2.getByRole('button', { name: 'Exportar', exact: true }).click(),
  ]);
  expect(xlsx.suggestedFilename()).toMatch(new RegExp(`^ogado-negocios-${HOJE.source}\\.xlsx$`));
  const zip = await conteudo(xlsx);
  expect(zip.subarray(0, 2).toString('latin1')).toBe('PK');
  expect(zip.includes(Buffer.from('xl/worksheets/sheet2.xml'))).toBe(true);

  // Meus dados (JSON da API)
  await page.getByRole('link', { name: 'Conta' }).filter({ visible: true }).click();
  const secao = page.getByRole('region', { name: 'Meus dados' });
  const [json] = await Promise.all([
    page.waitForEvent('download'),
    secao.getByRole('button', { name: 'Baixar meus dados (JSON)' }).click(),
  ]);
  expect(json.suggestedFilename()).toMatch(new RegExp(`^ogado-meus-dados-${HOJE.source}\\.json$`));
  const bruto = (await conteudo(json)).toString('utf8');
  const dados = JSON.parse(bruto) as {
    versaoDoFormato: number;
    perfil: { email: string; temSenha: boolean };
    lotes: { categoria: string; tipo: string }[];
  };
  expect(dados.versaoDoFormato).toBe(1);
  expect(dados.perfil.email).toBe(email);
  expect(dados.perfil.temSenha).toBe(true);
  expect(dados.lotes.map((l) => l.categoria)).toEqual(['Bezerros; "nelore"'.toUpperCase()]);
  expect(bruto).not.toMatch(/senhaHash|argon2|\$argon/i);
  expect(bruto).not.toContain(SENHA);

  expect(erros).toEqual([]);
});
