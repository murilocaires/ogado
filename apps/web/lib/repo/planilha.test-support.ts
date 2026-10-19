// Só para testes (ADR-0014): o simulador novo abre vazio; os testes que provam o valor de ouro da
// planilha (R$ 102.408,05) preenchem as entradas da planilha explicitamente, como o usuário faria.
import { Decimal, ENTRADA_PADRAO } from '@ogado/domain';
import { paraCampo } from '../format';
import { criarRepoLocal } from './local-repo';
import { RECRIA_CAMPOS, type OGadoRepo, type RecriaForm } from './types';

const CAMPOS_PERCENTUAIS = new Set(['consumoPct', 'rendCarcaca', 'imposto']);

/** Entradas da planilha como texto de campo pt-BR (fração do domínio -> % na tela). */
export function recriaFormPlanilha(): RecriaForm {
  const form = {} as RecriaForm;
  for (const campo of RECRIA_CAMPOS) {
    const original = ENTRADA_PADRAO[campo];
    form[campo] = paraCampo(
      CAMPOS_PERCENTUAIS.has(campo) ? new Decimal(original).times(100) : original,
    );
  }
  return form;
}

/** Repositório em memória com as entradas da planilha já preenchidas. */
export function criarRepoComPlanilha(storage: () => Storage | null): OGadoRepo {
  const repo = criarRepoLocal({ storage });
  repo.atualizarRecria({ form: recriaFormPlanilha(), lotacaoInicial: 'areaPastavel' });
  return repo;
}
