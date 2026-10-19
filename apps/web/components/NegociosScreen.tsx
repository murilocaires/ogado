'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { baixarArquivo, gerarArquivo } from '../lib/exportacao/baixar';
import { prepararNegocios, type ConteudoNegocios } from '../lib/exportacao/dados';
import { brl, brlComSinal, capitalizar, dataBR, ehNegativo, num } from '../lib/format';
import { ordenarPorData, resumirNegocios, type ItemNegocio } from '../lib/negocios';
import { useRepo, useRepoState } from '../lib/repo/repo-provider';
import type { LoteTipo } from '../lib/repo/types';
import { Carregando, PageHeader } from './AppShell';
import { ConfirmDialog } from './Dialog';
import { ExportarDialog } from './ExportarDialog';
import { Icon } from './Icon';
import { InfoPopover } from './InfoPopover';
import { LoteModal } from './LoteModal';
import { SeloSync } from './SyncIndicador';
import { useToast } from './Toast';

type Aba = 'todas' | 'compras' | 'vendas';

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'compras', rotulo: 'Compras' },
  { id: 'vendas', rotulo: 'Vendas' },
];

type ModalAberto = { tipo: LoteTipo; loteId?: string } | null;

function descricaoItem(x: ItemNegocio): string {
  const partes = [capitalizar(x.lote.categoria), dataBR(x.lote.data)];
  if (x.lote.modo === 'individual') partes.push('peso a peso');
  if (x.tipo === 'venda') {
    partes.push(x.lote.base === 'carcaca' ? 'carcaça' : 'peso vivo');
    const kg = x.linha.descontoKgCab;
    partes.push(
      x.linha.kgDescontado.gt(0) ? `desc. ${num(kg, kg.isInteger() ? 0 : 1)} kg/cab.` : 'sem desconto',
    );
  }
  return partes.join(' · ');
}

function Etiqueta({ tipo }: { tipo: LoteTipo }) {
  return (
    <span className={`tag${tipo === 'venda' ? ' v' : ''}`} style={{ marginRight: 8 }}>
      {tipo === 'venda' ? 'VENDA' : 'COMPRA'}
    </span>
  );
}

/** Negócios (RF-024): compras e vendas numa tela só, com saldo (RF-023). */
export function NegociosScreen() {
  const dados = useRepoState();
  const repo = useRepo();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [aba, setAba] = useState<Aba>('todas');
  const [modal, setModal] = useState<ModalAberto>(null);
  const [excluindo, setExcluindo] = useState<ItemNegocio | null>(null);
  const [exportando, setExportando] = useState(false);

  const pronto = dados.status === 'pronto';
  const novoParam = params.get('novo');

  // Atalhos do Painel (`/negocios?novo=compra|venda`) abrem o modal e limpam o endereço.
  useEffect(() => {
    if (!pronto || (novoParam !== 'compra' && novoParam !== 'venda')) return;
    setAba('todas');
    setModal({ tipo: novoParam });
    router.replace('/negocios', { scroll: false });
  }, [pronto, novoParam, router]);

  const lotes = dados.status === 'pronto' ? dados.lotes : [];
  const { resultado: cv, itens } = useMemo(() => resumirNegocios(lotes), [lotes]);

  if (dados.status === 'carregando') {
    return (
      <>
        <PageHeader titulo="Compra e Venda" />
        <Carregando />
      </>
    );
  }

  const visiveis = ordenarPorData(
    itens.filter(
      (x) => aba === 'todas' || (aba === 'compras' ? x.tipo === 'compra' : x.tipo === 'venda'),
    ),
  );
  const todas = aba === 'todas';
  const nCompras = itens.filter((x) => x.tipo === 'compra').length;
  const nVendas = itens.length - nCompras;
  const plural = (n: number, s: string): string => `${n} ${s}${n === 1 ? '' : 's'}`;

  let resumoEsq: string;
  let resumoDir = '';
  if (aba === 'compras') {
    resumoEsq = `${num(cv.cabCompra, 0)} cab. · ${num(cv.arrCompra, 2)} @`;
    resumoDir = brl(cv.totalCompras);
  } else if (aba === 'vendas') {
    resumoEsq = `${num(cv.cabVenda, 0)} cab. · ${num(cv.arrVenda, 2)} @`;
    resumoDir = brl(cv.totalVendas);
  } else {
    resumoEsq = `${plural(itens.length, 'lançamento')} · ${plural(nCompras, 'compra')} · ${plural(nVendas, 'venda')}`;
  }

  const novoPadrao: LoteTipo = aba === 'vendas' ? 'venda' : 'compra';
  const editando = modal?.loteId ? lotes.find((l) => l.id === modal.loteId) : undefined;

  function botoes(x: ItemNegocio) {
    return (
      <>
        <button
          type="button"
          className="icon-b"
          aria-label={`Editar lote ${x.lote.numero} de ${x.tipo}`}
          onClick={() => setModal({ tipo: x.tipo, loteId: x.lote.id })}
        >
          <Icon name="edit" size={18} />
        </button>
        <button
          type="button"
          className="icon-b"
          aria-label={`Excluir lote ${x.lote.numero} de ${x.tipo}`}
          onClick={() => setExcluindo(x)}
        >
          <Icon name="trash" size={18} />
        </button>
      </>
    );
  }

  const arrInfo = aba === 'vendas' ? 'arrV' : 'arrC';

  return (
    <>
      <PageHeader
        titulo="Compra e Venda"
        sub="Todos os lotes comprados e vendidos, com o saldo do giro."
        acoes={
          <>
            <button type="button" className="btn sec" onClick={() => setExportando(true)}>
              <Icon name="baixar" size={20} />
              Exportar
            </button>
            <button type="button" className="btn" onClick={() => setModal({ tipo: novoPadrao })}>
              <Icon name="plus" size={20} />
              Novo lote
            </button>
          </>
        }
      />

      <div className="strip" role="group" aria-label="Resumo do saldo">
        <div>
          <div className="th">
            Saldo
            <InfoPopover k="saldo" />
          </div>
          <div
            className={`sv ${ehNegativo(cv.saldo) ? 'txt-neg' : 'txt-pos'}`}
            aria-live="polite"
            data-testid="saldo"
          >
            {brlComSinal(cv.saldo)}
          </div>
        </div>
        <div>
          <div className="th">
            Comprado
            <InfoPopover k="comprado" />
          </div>
          <div className="sv" aria-live="polite">
            {brl(cv.totalCompras, 0)}
          </div>
        </div>
        <div>
          <div className="th">
            Vendido
            <InfoPopover k="vendido" />
          </div>
          <div className="sv" aria-live="polite">
            {brl(cv.totalVendas, 0)}
          </div>
        </div>
      </div>

      <div
        className="seg"
        role="tablist"
        aria-label="Tipo de lançamento"
        style={{ maxWidth: 420, margin: '16px 0 10px' }}
      >
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div className="resumo-aba">
        <span>{resumoEsq}</span>
        <b>{resumoDir}</b>
      </div>

      {aba === 'vendas' && (
        <div className="note" style={{ marginBottom: 12 }}>
          Dica: em vendas de fêmeas, é comum descontar 10% do peso. Você pode ajustar ou desligar
          isso em cada lote.
        </div>
      )}

      {visiveis.length ? (
        <>
          <div className="card tbl-d" style={{ padding: '8px 14px' }}>
            <table>
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Cab.</th>
                  <th>Peso (kg)</th>
                  <th>
                    @<InfoPopover k={arrInfo} />
                  </th>
                  <th>R$/@</th>
                  <th>
                    Total
                    <InfoPopover k="totalLote" />
                  </th>
                  <th>
                    R$/cab.
                    <InfoPopover k="porCab" />
                  </th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((x) => (
                  <tr key={x.lote.id}>
                    <td>
                      {todas && <Etiqueta tipo={x.tipo} />}
                      <b>Lote {x.lote.numero}</b>
                      <SeloSync id={x.lote.id} />
                      <br />
                      <span className="hint">{descricaoItem(x)}</span>
                    </td>
                    <td>{num(x.linha.qtd, 0)}</td>
                    <td>{num(x.linha.kg, 0)}</td>
                    <td className="calc-c">{num(x.linha.arrobas, 2)}</td>
                    <td>{brl(x.linha.preco)}</td>
                    <td className="calc-c">{brl(x.linha.total)}</td>
                    <td className="calc-c">{brl(x.linha.porCab)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{botoes(x)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lotes-m clist">
            {visiveis.map((x) => (
              <div className="lrow" key={x.lote.id}>
                <div className="l1">
                  <b>
                    {todas && <Etiqueta tipo={x.tipo} />}
                    Lote {x.lote.numero} · {capitalizar(x.lote.categoria)}
                    <SeloSync id={x.lote.id} />
                  </b>
                  <span
                    style={todas && x.tipo === 'venda' ? { color: 'var(--folha-600)' } : undefined}
                  >
                    {brl(x.linha.total)}
                  </span>
                </div>
                <div className="l2">
                  <span>
                    {num(x.linha.qtd, 0)} cab. · {num(x.linha.arrobas, 2)} @ ·{' '}
                    {brl(x.linha.preco, 0)}/@ · {dataBR(x.lote.data)}
                  </span>
                  <span>{botoes(x)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="card empty">
          <h3>Nenhum lote{todas ? '' : ` de ${aba === 'compras' ? 'compra' : 'venda'}`}</h3>
          <p>Cadastre o primeiro para ver os totais e o saldo.</p>
          <button type="button" className="btn" onClick={() => setModal({ tipo: novoPadrao })}>
            Novo lote
          </button>
        </div>
      )}

      {modal && (editando || !modal.loteId) && (
        <LoteModal
          key={modal.loteId ?? `novo-${modal.tipo}`}
          tipo={modal.tipo}
          lote={editando}
          onClose={() => setModal(null)}
        />
      )}

      {exportando && (
        <ExportarDialog<ConteudoNegocios>
          titulo="Exportar compras e vendas"
          conteudos={[
            { id: 'ambos', rotulo: 'Compras e vendas', quantidade: itens.length },
            { id: 'compras', rotulo: 'Compras', quantidade: nCompras },
            { id: 'vendas', rotulo: 'Vendas', quantidade: nVendas },
          ]}
          conteudoInicial={aba === 'compras' ? 'compras' : aba === 'vendas' ? 'vendas' : 'ambos'}
          onClose={() => setExportando(false)}
          onExportar={async (formato, conteudo) => {
            const { tabelas, nomeBase } = prepararNegocios(lotes, conteudo, formato);
            const arquivo = await gerarArquivo(formato, tabelas, nomeBase);
            baixarArquivo(arquivo);
            return `Arquivo ${arquivo.nome} baixado.`;
          }}
        />
      )}

      {excluindo && (
        <ConfirmDialog
          titulo={`Excluir lote ${excluindo.lote.numero}?`}
          texto={`O lote de ${capitalizar(excluindo.lote.categoria)} será removido e o saldo recalculado. Esta ação não pode ser desfeita.`}
          confirmar="Excluir"
          perigo
          onCancel={() => setExcluindo(null)}
          onConfirm={() => {
            repo.excluirLote(excluindo.lote.id);
            setExcluindo(null);
            toast('Lote excluído.');
          }}
        />
      )}
    </>
  );
}
