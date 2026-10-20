// Domínio puro (sem I/O). Fórmulas entram em T-02/T-03 (ver ADR-0003 e 0008).
import DecimalBase from 'decimal.js';
const Decimal = DecimalBase.clone({ precision: 28 });
type Decimal = DecimalBase;

export { Decimal };

export {
  calcularCompra,
  calcularVenda,
  calcularCompraVenda,
  categoriaFeminina,
  PARAMETROS_COMPRA_VENDA,
  type ModoPeso,
  type LoteInput,
  type CompraVendaInput,
  type ParametrosCompraVenda,
  type LinhaCalculada,
  type CompraVendaResultado,
} from './compra-venda';
export { parseNumeroPtBr, formatarNumero, formatarBRL } from './pt-br';
export {
  CONFIGURACAO_PADRAO,
  PARAMETROS_FAZENDA_PADRAO,
  traduzirConfiguracao,
  type ArgumentosDeCalculo,
  type ConfiguracaoFazenda,
  type ParametrosFazenda,
} from './configuracao';
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
export { alertasRecria, LIMITES_ALERTA_RECRIA, type AlertaRecria } from './alertas-recria';
