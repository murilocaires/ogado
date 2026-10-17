// Domínio puro (sem I/O). Fórmulas entram em T-02/T-03 (ver ADR-0003 e 0008).
import Decimal from 'decimal.js';

Decimal.set({ precision: 28 });

export { Decimal };

export {
  calcularCompra,
  calcularVenda,
  calcularCompraVenda,
  PARAMETROS_COMPRA_VENDA,
  type ModoPeso,
  type LoteInput,
  type CompraVendaInput,
  type ParametrosCompraVenda,
  type LinhaCalculada,
  type CompraVendaResultado,
} from './compra-venda';
export { parseNumeroPtBr, formatarNumero, formatarBRL } from './pt-br';
export { calcularRecria, VARIANTES_PADRAO, PARAMETROS_PADRAO, ENTRADA_PADRAO } from './recria';
export type {
  EntradaRecria,
  ResultadoRecria,
  VariantesRecria,
  VarianteLotacaoInicial,
  VarianteFaturamentoBruto,
  ParametrosRecria,
  CustoRecria,
  Numerico,
  Valor,
} from './recria';
