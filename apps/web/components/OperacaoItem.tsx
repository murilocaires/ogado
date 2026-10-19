import type { ReactNode } from 'react';
import { brl, capitalizar } from '../lib/format';
import type { ItemNegocio } from '../lib/negocios';
import { SeloSync } from './SyncIndicador';

/**
 * Linha de operação (compra ou venda) usada no Painel ("Últimas operações") e na lista de
 * Negócios no celular: tipo, "Lote N · Categoria", detalhe, valor à direita, selo de sincronização
 * e, quando houver, as ações de editar/excluir. Deve ficar dentro de um `.ops`.
 */
export function OperacaoItem({
  item,
  detalhe,
  extra,
  casasValor = 0,
  mostrarTipo = true,
  acoes,
}: {
  item: ItemNegocio;
  detalhe: string;
  /** Segunda linha de detalhe (ex.: base e desconto da venda). */
  extra?: string;
  casasValor?: number;
  mostrarTipo?: boolean;
  acoes?: ReactNode;
}) {
  const { lote, tipo, linha } = item;
  const venda = tipo === 'venda';
  return (
    <div>
      {mostrarTipo && <span className={`tag${venda ? ' v' : ''}`}>{venda ? 'VENDA' : 'COMPRA'}</span>}
      <div className="m">
        <b>
          Lote {lote.numero} · {capitalizar(lote.categoria)}
          <SeloSync id={lote.id} />
        </b>
        <span>{detalhe}</span>
        {extra && <span>{extra}</span>}
      </div>
      <div className="op-dir">
        <b>{brl(linha.total, casasValor)}</b>
        {acoes && <div className="op-acoes">{acoes}</div>}
      </div>
    </div>
  );
}
