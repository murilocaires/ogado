// Ponte entre o formulário da recria e o domínio. Percentuais: tela em % -> domínio em fração.
import {
  alertasRecria,
  calcularRecria,
  type AlertaRecria,
  type EntradaRecria,
  type ResultadoRecria,
} from '@bovaro/domain';
import { valorCampo } from './format';
import type { RecriaEntity, RecriaForm } from './repo/types';

export function entradaRecria(form: RecriaForm): EntradaRecria {
  const v = (campo: keyof RecriaForm) => valorCampo(form[campo]);
  const fracao = (campo: keyof RecriaForm) => v(campo)?.div(100) ?? null;
  return {
    area: v('area'),
    dias: v('dias'),
    investimento: v('investimento'),
    rsCabCompra: v('rsCabCompra'),
    pesoIni: v('pesoIni'),
    pesoFin: v('pesoFin'),
    precoVenda: v('precoVenda'),
    consumoPct: fracao('consumoPct'),
    precoSuplKg: v('precoSuplKg'),
    rendCarcaca: fracao('rendCarcaca'),
    imposto: fracao('imposto'),
    sanidadeCabMes: v('sanidadeCabMes'),
    funcionario: v('funcionario'),
    frete: v('frete'),
  };
}

export interface RecriaCalculada {
  resultado: ResultadoRecria;
  alertas: AlertaRecria[];
}

export function calcularRecriaEntidade(recria: RecriaEntity): RecriaCalculada {
  const resultado = calcularRecria(
    entradaRecria(recria.form),
    {
      // RN-009: na simulação atual, UA total / área pastável informada (decisão de 20/10/2026).
      lotacaoInicial: 'areaPastavel',
      faturamentoBruto: recria.variantes?.faturamentoBruto ?? 'pesoVivo',
      cabecasInteiras: recria.variantes ? (recria.variantes.cabecasInteiras ?? false) : true,
    },
    recria.parametros,
  );
  return { resultado, alertas: alertasRecria(resultado) };
}
