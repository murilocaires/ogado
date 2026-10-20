import type { Page } from '@playwright/test';

/** Entradas independentes da planilha; rótulos atuais da UI. O domínio mantém seu ouro fracionário. */
export const ENTRADAS_PLANILHA: Record<string, string> = {
  'Área Pastável': '102',
  'Dias de Recria': '270',
  'Investimento (compra)': '122534,8',
  'R$/cab (compra)': '2050',
  'Peso inicial': '188',
  'Peso Final': '420',
  'R$/cab (venda)': '325',
  Proteinado: '0,3',
  'R$/Kg': '2',
  Se: '52',
  Imposto: '1,5',
  Sanidade: '2,5',
  Funcionário: '9000',
  'Transporte (frete)': '3000',
};

/** Ouro independente da variante UI de 60 cabeças; domínio padrão usa 59,773... e R$102.408,05. */
export const RESULTADO_CABECAS_INTEIRAS = 'R$ 103.307,60';

/** Digita as entradas da planilha na aba Simulador. */
export async function preencherPlanilha(page: Page): Promise<void> {
  for (const [rotulo, valor] of Object.entries(ENTRADAS_PLANILHA)) {
    const campo = page.getByLabel(rotulo, { exact: true });
    await campo.focus();
    await campo.fill(valor);
  }
}
