import type { Page } from '@playwright/test';

/** Entradas da planilha (fonte independente do app; ADR-0014: o simulador novo abre vazio). */
export const ENTRADAS_PLANILHA: Record<string, string> = {
  'Área pastável': '102',
  'Dias de recria': '270',
  Investimento: '122534,8',
  'R$ por cabeça (compra)': '2050',
  'Peso inicial': '188',
  'Peso final': '420',
  'Preço de venda': '325',
  'Consumo (% do peso vivo)': '0,3',
  Proteinado: '2',
  'Rendimento de carcaça': '52',
  'Imposto sobre a venda': '1,5',
  Sanidade: '2,5',
  Funcionário: '9000',
  Frete: '3000',
};

/** Digita as entradas da planilha na aba Simulador (valor de ouro: R$ 102.408,05). */
export async function preencherPlanilha(page: Page): Promise<void> {
  for (const [rotulo, valor] of Object.entries(ENTRADAS_PLANILHA)) {
    await page.getByLabel(rotulo, { exact: true }).fill(valor);
  }
}
