import { z } from 'zod';

/** Decimal de entrada: string canônica (ponto, sem sinal, sem expoente, sem vírgula). ADR-0011 §6. */
const DECIMAL_INPUT = /^\d+(\.\d+)?$/;

export interface DecimalColumn {
  /** Campo na mensagem de erro, já com artigo (ex.: "A quantidade"). */
  rotulo: string;
  /** Dígitos totais da coluna (`Decimal(precisao, escala)`). */
  precisao: number;
  escala: number;
  /** Divisor ou quantidade que não pode ser zero. */
  positivo?: boolean;
  /** Valor máximo (ex.: 1 para fração). Faixa técnica, nunca de negócio. */
  maximo?: number;
}

interface CheckCtx {
  issues: unknown[];
  value: string;
}

function issue(ctx: CheckCtx, regra: string, message: string): void {
  ctx.issues.push({ code: 'custom', input: ctx.value, message, params: { regra } });
}

/**
 * String decimal validada só pela forma e pela capacidade da coluna (sem faixas de negócio).
 * Mais casas que a escala é recusado (`casas_decimais`), nunca arredondado em silêncio.
 */
export function decimalStringSchema(col: DecimalColumn) {
  return z.string({ error: `Informe ${col.rotulo.toLowerCase()}.` }).check((ctx) => {
    const valor = ctx.value;
    if (!DECIMAL_INPUT.test(valor) || valor.length > 40) {
      issue(ctx, 'formato', `${col.rotulo} deve ser um número com ponto decimal, sem sinal.`);
      return;
    }
    const [inteiro = '0', fracaoBruta = ''] = valor.split('.');
    const fracao = fracaoBruta.replace(/0+$/, '');
    const inteiroLimpo = inteiro.replace(/^0+(?=\d)/, '');
    if (fracao.length > col.escala) {
      issue(ctx, 'casas_decimais', `${col.rotulo} aceita no máximo ${col.escala} casas decimais.`);
      return;
    }
    if (inteiroLimpo.length > col.precisao - col.escala) {
      issue(ctx, 'faixa', `${col.rotulo} excede o valor máximo permitido.`);
      return;
    }
    if (col.positivo && inteiroLimpo === '0' && fracao === '') {
      issue(ctx, 'faixa', `${col.rotulo} deve ser maior que zero.`);
      return;
    }
    if (col.maximo !== undefined) {
      const inteiroNum = Number(inteiroLimpo);
      if (inteiroNum > col.maximo || (inteiroNum === col.maximo && fracao !== '')) {
        issue(ctx, 'faixa', `${col.rotulo} deve ser no máximo ${col.maximo}.`);
      }
    }
  });
}
