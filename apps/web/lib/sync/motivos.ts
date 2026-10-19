// Motivos em pt-BR para itens que o servidor recusou (RF-079). O texto vem do próprio erro da API
// (campo + mensagem); aqui só se troca o caminho técnico pelo rótulo que o produtor conhece.
import type { CampoInvalido } from './data-client';

const ROTULOS: Record<string, string> = {
  qtd: 'Quantidade',
  peso: 'Peso',
  pesos: 'Pesos',
  preco: 'Preço da arroba',
  categoria: 'Categoria',
  data: 'Data',
  modo: 'Modo de peso',
  base: 'Base da arroba',
  desconto: 'Desconto',
  nome: 'Nome',
  entradas: 'Entradas',
  lotacaoInicial: 'Lotação inicial',
};

export const MOTIVO_CONTRATO =
  'O servidor não aceitou este item. Confira os dados ou exclua o lançamento.';

function rotulo(caminho: string): string {
  const raiz = caminho.split('.')[0] ?? '';
  const [, resto] = caminho.split('.');
  const base = ROTULOS[raiz] ?? raiz;
  return resto && raiz === 'entradas' ? `${base} (${resto})` : base;
}

/** "Quantidade: Informe uma quantidade válida." (vários campos separados por " · "). */
export function motivoDeValidacao(campos: readonly CampoInvalido[], mensagem: string): string {
  if (campos.length === 0) return mensagem || MOTIVO_CONTRATO;
  return campos
    .map((c) => (c.caminho ? `${rotulo(c.caminho)}: ${c.mensagem}` : c.mensagem))
    .join(' · ');
}
