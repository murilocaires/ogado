'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { brl, brlComSinal, capitalizar, dataBR, ehNegativo, num } from '../lib/format';
import { ordenarPorData, resumirNegocios } from '../lib/negocios';
import { calcularRecriaEntidade } from '../lib/recria';
import { useRepoState } from '../lib/repo/repo-provider';
import { Carregando, PageHeader } from './AppShell';
import { Icon } from './Icon';
import { InfoPopover } from './InfoPopover';

/** Painel (RF-040): saldo, recria atual, atalhos e as últimas 6 operações. */
export function PainelScreen() {
  const dados = useRepoState();
  const lotes = dados.status === 'pronto' ? dados.lotes : null;
  const recria = dados.status === 'pronto' ? dados.recria : null;

  const resumo = useMemo(() => (lotes ? resumirNegocios(lotes) : null), [lotes]);
  const calculada = useMemo(() => (recria ? calcularRecriaEntidade(recria) : null), [recria]);

  if (!resumo || !calculada) {
    return (
      <>
        <PageHeader titulo="Olá" />
        <Carregando />
      </>
    );
  }

  const { resultado: cv, itens } = resumo;
  const r = calculada.resultado;
  const recentes = ordenarPorData(itens).slice(0, 6);
  const vazio = itens.length === 0;
  const saldoNeg = ehNegativo(cv.saldo);
  const frase = vazio
    ? 'Cadastre seu primeiro lote para ver o saldo.'
    : saldoNeg
      ? 'Comprou mais do que vendeu.'
      : cv.saldo.isZero()
        ? 'Compras e vendas estão equilibradas.'
        : 'Vendeu mais do que comprou.';

  return (
    <>
      <PageHeader
        titulo="Olá"
        sub={`${num(cv.cabCompra, 0)} cab. compradas · ${num(cv.cabVenda, 0)} vendidas`}
      />

      <div className="pgrid">
        <section className="hero" aria-label="Saldo de compra e venda">
          <div className="th">
            Saldo de compra e venda
            <InfoPopover k="saldo" />
          </div>
          <div className={`big ${saldoNeg ? 'neg' : 'pos'}`} aria-live="polite" data-testid="saldo">
            {brlComSinal(cv.saldo)}
          </div>
          <p className="hero-sub">{frase}</p>
          <div className="grid g2 keep2">
            <div className="mini">
              <span className="th">
                Comprado
                <InfoPopover k="comprado" />
              </span>
              <b aria-live="polite">{brl(cv.totalCompras, 0)}</b>
            </div>
            <div className="mini">
              <span className="th">
                Vendido
                <InfoPopover k="vendido" />
              </span>
              <b aria-live="polite">{brl(cv.totalVendas, 0)}</b>
            </div>
          </div>
        </section>

        <section className="card" aria-label="Recria, simulação atual">
          <div className="th">Recria · simulação atual</div>
          <div style={{ marginTop: 10, color: 'var(--tinta-2)', fontSize: 14 }}>
            Faturamento líquido
            <InfoPopover k="recLiq" />
          </div>
          <div
            className="big"
            style={{
              fontSize: 34,
              color: ehNegativo(r.faturamentoLiquido) ? 'var(--barro-600)' : 'var(--folha-600)',
            }}
          >
            {brl(r.faturamentoLiquido)}
          </div>
          <div className="grid g2 keep2" style={{ marginTop: 14, gap: 10 }}>
            <div>
              <div className="th">
                Por mês
                <InfoPopover k="mes" />
              </div>
              <b>{brl(r.liquidoMes, 0)}</b>
            </div>
            <div>
              <div className="th">
                Por hectare
                <InfoPopover k="ha" />
              </div>
              <b>{brl(r.liquidoHa, 0)}</b>
            </div>
          </div>
          <p style={{ margin: '14px 0 0' }}>
            <Link href="/recria" className="link">
              Ver detalhes da recria →
            </Link>
          </p>
        </section>
      </div>

      <div className="grid g3" style={{ marginTop: 16 }}>
        <Link className="card atalho" href="/negocios?novo=compra">
          <Icon name="plus" />
          Nova compra
        </Link>
        <Link className="card atalho" href="/negocios?novo=venda">
          <Icon name="plus" />
          Nova venda
        </Link>
        <Link className="card atalho" href="/recria">
          <Icon name="calc" />
          Simular recria
        </Link>
      </div>

      <section className="card" style={{ marginTop: 16 }} aria-labelledby="p-ops">
        <h2 id="p-ops">Últimas operações</h2>
        {recentes.length ? (
          <div className="ops">
            {recentes.map((x) => (
              <div key={x.lote.id}>
                <span className={`tag${x.tipo === 'venda' ? ' v' : ''}`}>
                  {x.tipo === 'venda' ? 'VENDA' : 'COMPRA'}
                </span>
                <div className="m">
                  <b>
                    Lote {x.lote.numero} · {capitalizar(x.lote.categoria)}
                  </b>
                  <span>
                    {num(x.linha.qtd, 0)} cab. · {dataBR(x.lote.data)}
                  </span>
                </div>
                <b>{brl(x.linha.total, 0)}</b>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ padding: '24px 0 8px' }}>
            <h3 style={{ marginTop: 0 }}>Nenhuma operação ainda</h3>
            <p>Suas compras e vendas aparecem aqui.</p>
            <Link href="/negocios?novo=compra" className="btn">
              Cadastrar primeiro lote
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
