// Configuração da fazenda (RN-021, RN-023, ADR-0011): os 9 parâmetros e as 2 variantes.
// Domínio puro: o padrão é montado a partir dos padrões que já existem (sem repetir números) e a
// tradução para argumentos de cálculo é uma função sem estado global.
import type Decimal from 'decimal.js';
import { PARAMETROS_COMPRA_VENDA, type ParametrosCompraVenda } from './compra-venda';
import {
  ENTRADA_PADRAO,
  PARAMETROS_PADRAO,
  VARIANTES_PADRAO,
  type EntradaRecria,
  type ParametrosRecria,
  type VariantesRecria,
} from './recria';

/**
 * Os 9 parâmetros de cálculo da fazenda (RN-021), cada valor uma única vez (RN-020).
 * Decimais como string canônica; percentuais em fração (0,52 = 52%).
 */
export interface ParametrosFazenda<T = string> {
  /** kg de peso vivo por @: @ na compra e @ do peso vivo da recria. */
  arrobaVivoKg: T;
  /** kg de carcaça por @: @ na venda e @ de carcaça da recria. */
  arrobaCarcacaKg: T;
  /** Desconto padrão da venda, em kg por cabeça (RN-025, ADR-0013). */
  descontoVendaKgCab: T;
  /** kg por unidade animal (UA). */
  uaKg: T;
  /** Valor inicial do simulador: rendimento de carcaça (fração). */
  rendCarcaca: T;
  /** Valor inicial do simulador: imposto (fração). */
  imposto: T;
  /** Valor inicial do simulador: consumo de suplemento (fração do peso vivo). */
  consumoPct: T;
  /** Valor inicial do simulador: R$/kg de suplemento. */
  precoSuplKg: T;
  /** Valor inicial do simulador: R$/cab/mês de sanidade. */
  sanidadeCabMes: T;
}

export interface ConfiguracaoFazenda {
  parametros: ParametrosFazenda;
  variantes: VariantesRecria;
}

export const PARAMETROS_FAZENDA_PADRAO: Readonly<ParametrosFazenda> = {
  arrobaVivoKg: PARAMETROS_PADRAO.arrobaVivoKg,
  arrobaCarcacaKg: PARAMETROS_PADRAO.arrobaCarcacaKg,
  descontoVendaKgCab: PARAMETROS_COMPRA_VENDA.descontoVendaKgCab.toString(),
  uaKg: PARAMETROS_PADRAO.uaKg,
  rendCarcaca: ENTRADA_PADRAO.rendCarcaca,
  imposto: ENTRADA_PADRAO.imposto,
  consumoPct: ENTRADA_PADRAO.consumoPct,
  precoSuplKg: ENTRADA_PADRAO.precoSuplKg,
  sanidadeCabMes: ENTRADA_PADRAO.sanidadeCabMes,
};

/** Padrão da planilha: "Voltar aos valores da planilha" envia exatamente isto. */
export const CONFIGURACAO_PADRAO: Readonly<ConfiguracaoFazenda> = {
  parametros: PARAMETROS_FAZENDA_PADRAO,
  variantes: VARIANTES_PADRAO,
};

export interface ArgumentosDeCalculo {
  variantes: VariantesRecria;
  /** Sem `lotacaoFixaHa`: o divisor fixo de 80 ha não é parâmetro da fazenda (ADR-0011 §1). */
  parametrosRecria: Pick<ParametrosRecria<string>, 'arrobaVivoKg' | 'arrobaCarcacaKg' | 'uaKg'>;
  parametrosCompraVenda: Record<keyof ParametrosCompraVenda, Decimal.Value>;
  /** Valores iniciais com que o simulador de recria abre (RN-021). */
  entradaInicialRecria: Pick<
    EntradaRecria,
    'rendCarcaca' | 'imposto' | 'consumoPct' | 'precoSuplKg' | 'sanidadeCabMes'
  >;
}

/**
 * Traduz a configuração da fazenda em argumentos de `calcularRecria` e `calcularCompraVenda`
 * (o mapeamento dos nomes vive só aqui). Pura: nada é lido de estado global.
 */
export function traduzirConfiguracao(config: ConfiguracaoFazenda): ArgumentosDeCalculo {
  const p = config.parametros;
  return {
    variantes: { ...config.variantes },
    parametrosRecria: {
      arrobaVivoKg: p.arrobaVivoKg,
      arrobaCarcacaKg: p.arrobaCarcacaKg,
      uaKg: p.uaKg,
    },
    parametrosCompraVenda: {
      arrobaVivoKg: p.arrobaVivoKg,
      arrobaCarcacaKg: p.arrobaCarcacaKg,
      descontoVendaKgCab: p.descontoVendaKgCab,
    },
    entradaInicialRecria: {
      rendCarcaca: p.rendCarcaca,
      imposto: p.imposto,
      consumoPct: p.consumoPct,
      precoSuplKg: p.precoSuplKg,
      sanidadeCabMes: p.sanidadeCabMes,
    },
  };
}
