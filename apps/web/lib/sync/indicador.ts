// Texto e tom do indicador de sincronização (RF-075). Puro, para a mesma regra valer no menu
// lateral e na tela estreita. `rotuloSync` é o indicador global: só existe sem internet.
// `descreverSync` é o estado completo, usado na seção Sincronização da Conta.
export type StatusSync = 'desligado' | 'sincronizando' | 'sincronizado' | 'offline' | 'erro';

export type TomIndicador = 'neutro' | 'ok' | 'pendente' | 'offline' | 'erro';

export interface RotuloSync {
  tom: TomIndicador;
  /** Curto, para a pílula. */
  texto: string;
  /** Frase de apoio (menu lateral). */
  detalhe: string;
}

export function pluralPendentes(n: number): string {
  return `${n} ${n === 1 ? 'pendente' : 'pendentes'}`;
}

export function descreverSync(status: StatusSync, pendentes: number, online: boolean): RotuloSync {
  if (status === 'desligado') {
    return {
      tom: 'neutro',
      texto: 'Só neste aparelho',
      detalhe: 'Seus dados ficam salvos neste navegador.',
    };
  }
  const resto = pendentes > 0 ? ` · ${pluralPendentes(pendentes)}` : '';
  if (status === 'offline' || !online) {
    return {
      tom: 'offline',
      texto: `Sem conexão${resto}`,
      detalhe: 'Salvo neste aparelho, sobe quando a conexão voltar.',
    };
  }
  if (status === 'erro') {
    return {
      tom: 'erro',
      texto: `Erro ao sincronizar${resto}`,
      detalhe: 'Não foi possível sincronizar agora. Tentaremos de novo.',
    };
  }
  if (status === 'sincronizando') {
    return {
      tom: 'pendente',
      texto: `Sincronizando…${resto}`,
      detalhe: 'Sincronizando com a nuvem…',
    };
  }
  if (pendentes > 0) {
    return {
      tom: 'pendente',
      texto: pluralPendentes(pendentes),
      detalhe: 'Salvo neste aparelho, ainda não enviado para a nuvem.',
    };
  }
  return { tom: 'ok', texto: 'Sincronizado', detalhe: 'Dados salvos na sua conta.' };
}

/**
 * Indicador global (menu lateral e topo): aparece só sem internet ("Sem conexão · N pendentes")
 * e some quando a conexão volta. Conectado, sincronizando, com erro ou sem conta: nada.
 */
export function rotuloSync(
  status: StatusSync,
  pendentes: number,
  online: boolean,
): RotuloSync | null {
  if (status === 'desligado') return null;
  if (status === 'offline' || !online) return descreverSync(status, pendentes, online);
  return null;
}
