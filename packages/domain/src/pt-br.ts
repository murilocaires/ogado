// Parser e formatação pt-BR (RNF-007). Puro: sem I/O, sem Intl (resultado determinístico).
import Decimal from 'decimal.js';

Decimal.set({ precision: 28 });

const MENOS_TIPOGRAFICO = '−';
const TRACO = '—';
const MILHAR = /^\d{1,3}(\.\d{3})+$/;

/**
 * Lê um número digitado em pt-BR (`1.234,56`, `R$ 10,5`, `1,5%`, `-3`).
 * Retorna `null` para vazio ou inválido (o chamador decide se vale 0 ou erro de campo).
 * Sem vírgula, `1.234` é milhar (1234) e `12.5` é decimal (12,5), como na planilha.
 */
export function parseNumeroPtBr(entrada: string | number | null | undefined): Decimal | null {
  if (entrada === null || entrada === undefined) return null;
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? new Decimal(entrada) : null;

  let s = entrada.replace(/R\$|%|\s/g, '').replace(MENOS_TIPOGRAFICO, '-');
  if (s === '') return null;

  let sinal = '';
  if (s.startsWith('-')) {
    sinal = '-';
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const virgula = s.indexOf(',');
  if (virgula >= 0) {
    const inteiro = s.slice(0, virgula);
    const fracao = s.slice(virgula + 1); // segunda vírgula cai na validação abaixo
    if (!/^\d+$/.test(fracao)) return null;
    if (inteiro !== '' && !/^\d+$/.test(inteiro) && !MILHAR.test(inteiro)) return null;
    return new Decimal(`${sinal}${inteiro.replace(/\./g, '') || '0'}.${fracao}`);
  }

  if (MILHAR.test(s)) return new Decimal(sinal + s.replace(/\./g, ''));
  if (/^\d+(\.\d+)?$/.test(s)) return new Decimal(sinal + s);
  return null;
}

interface PartesFormatadas {
  negativo: boolean;
  texto: string;
}

function formatarPartes(
  valor: Decimal.Value | null | undefined,
  casas: number,
): PartesFormatadas | null {
  if (valor === null || valor === undefined) return null;
  let d: Decimal;
  try {
    d = new Decimal(valor);
  } catch {
    return null;
  }
  if (!d.isFinite()) return null;
  const fixo = d.abs().toFixed(casas, Decimal.ROUND_HALF_UP);
  const ponto = fixo.indexOf('.');
  const inteiro = ponto < 0 ? fixo : fixo.slice(0, ponto);
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const texto = ponto < 0 ? agrupado : `${agrupado},${fixo.slice(ponto + 1)}`;
  const zero = /^[0.]*$/.test(fixo);
  return { negativo: d.isNegative() && !zero, texto };
}

/** Formata para exibição (`1.234,56`); arredonda só aqui, meio para cima. `—` se inválido. */
export function formatarNumero(valor: Decimal.Value | null | undefined, casas = 2): string {
  const p = formatarPartes(valor, casas);
  return p === null ? TRACO : `${p.negativo ? MENOS_TIPOGRAFICO : ''}${p.texto}`;
}

/** Formata em BRL (`R$ 1.234,50`); negativo como `−R$ 89.475,83`. `—` se inválido. */
export function formatarBRL(valor: Decimal.Value | null | undefined, casas = 2): string {
  const p = formatarPartes(valor, casas);
  return p === null ? TRACO : `${p.negativo ? MENOS_TIPOGRAFICO : ''}R$ ${p.texto}`;
}
