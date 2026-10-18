// Entrada e saída pt-BR da UI (RNF-007, RN-022). Só delega ao domínio; nenhuma fórmula aqui.
import { Decimal, formatarBRL, formatarNumero, parseNumeroPtBr } from '@ogado/domain';

export const TRACO = '—';

export type Valor = Decimal | null | undefined;

/** Leitura de um campo digitado: vazio, válido ou inválido (com a dica para o usuário). */
export type LeituraCampo =
  | { tipo: 'vazio' }
  | { tipo: 'ok'; valor: Decimal }
  | { tipo: 'invalido'; dica: string };

const PONTO_AMBIGUO = /^-?\d+\.\d+$|^-?\d{1,3}(\.\d{3})$/;

export const DICA_VAZIO = 'Preencha este campo para calcular.';

/** Lê um texto digitado em pt-BR. Só a vírgula é decimal (RNF-007). */
export function lerCampo(texto: string): LeituraCampo {
  if (texto.trim() === '') return { tipo: 'vazio' };
  const valor = parseNumeroPtBr(texto);
  if (valor) return { tipo: 'ok', valor };
  if (PONTO_AMBIGUO.test(texto.trim())) {
    return {
      tipo: 'invalido',
      dica: 'Use vírgula para os decimais (ex.: 1,5). Para mil, escreva 1500, sem ponto.',
    };
  }
  return {
    tipo: 'invalido',
    dica: 'Número inválido. Use só dígitos e vírgula decimal (ex.: 1.234,5).',
  };
}

/** Valor numérico do campo ou `null` se vazio/inválido (o domínio trata `null` como indefinido). */
export function valorCampo(texto: string): Decimal | null {
  const leitura = lerCampo(texto);
  return leitura.tipo === 'ok' ? leitura.valor : null;
}

/** Dica de um campo: inválido explica o motivo; vazio (quando exigido) pede o preenchimento. */
export function dicaCampo(texto: string, exigido = true): string | null {
  const leitura = lerCampo(texto);
  if (leitura.tipo === 'invalido') return leitura.dica;
  if (leitura.tipo === 'vazio' && exigido) return DICA_VAZIO;
  return null;
}

export function num(valor: Valor, casas = 2): string {
  return formatarNumero(valor, casas);
}

/** Número sem zeros à direita (`450,50` -> `450,5`; `450,00` -> `450`). */
export function numCompacto(valor: Valor, casas = 2): string {
  return formatarNumero(valor, casas).replace(/(,\d*?)0+$/, '$1').replace(/,$/, '');
}

export function brl(valor: Valor, casas = 2): string {
  return formatarBRL(valor, casas);
}

/** Saldo com sinal explícito: `+R$ 1,00` / `−R$ 1,00` (o domínio já escreve o menos tipográfico). */
export function brlComSinal(valor: Valor, casas = 2): string {
  if (!valor) return TRACO;
  const texto = formatarBRL(valor, casas);
  return valor.isPositive() && !valor.isZero() && texto !== TRACO ? `+${texto}` : texto;
}

export function ehNegativo(valor: Valor): boolean {
  return !!valor && valor.isNegative() && !valor.isZero();
}

/** Decimal -> texto de campo pt-BR (`122534.8` -> `122534,8`), sem agrupar milhar. */
export function paraCampo(valor: string | Decimal): string {
  const texto = typeof valor === 'string' ? valor : valor.toFixed();
  return texto.replace('.', ',');
}

/** Data ISO (`2026-10-18`) -> `18/10/2026`; vazio -> `sem data`. */
export function dataBR(iso: string): string {
  return iso ? iso.split('-').reverse().join('/') : 'sem data';
}

/** `BOIS` -> `Bois` (exibição de categorias gravadas em maiúsculas). */
export function capitalizar(texto: string): string {
  const t = String(texto ?? '');
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function hojeISO(agora: Date = new Date()): string {
  const mm = String(agora.getMonth() + 1).padStart(2, '0');
  const dd = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mm}-${dd}`;
}
