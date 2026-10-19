'use client';

import type { AlertaRecria, Decimal, ResultadoRecria } from '@ogado/domain';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { brl, dicaCampo, ehNegativo, lerCampo, num, TRACO } from '../lib/format';
import { snapshotDaRecria } from '../lib/cenarios';
import { CUSTO_CORES } from '../lib/custo-cores';
import { calcularRecriaEntidade } from '../lib/recria';
import { useRepo, useRepoState } from '../lib/repo/repo-provider';
import type { RecriaCampo } from '../lib/repo/types';
import { Carregando, PageHeader } from './AppShell';
import { CenariosScreen } from './CenariosScreen';
import { ConfirmDialog } from './Dialog';
import { CampoCalculado, CampoNumero } from './Fields';
import type { InfoKey } from '../lib/info';
import { InfoPopover } from './InfoPopover';
import { NomeDialog } from './NomeDialog';
import { useToast } from './Toast';

interface CampoDef {
  id: RecriaCampo;
  rotulo: string;
  prefixo?: string;
  sufixo?: string;
}

const CAMPOS: Record<RecriaCampo, CampoDef> = {
  area: { id: 'area', rotulo: 'Área pastável', sufixo: 'ha' },
  dias: { id: 'dias', rotulo: 'Dias de recria', sufixo: 'dias' },
  investimento: { id: 'investimento', rotulo: 'Investimento', prefixo: 'R$' },
  rsCabCompra: { id: 'rsCabCompra', rotulo: 'R$ por cabeça (compra)', prefixo: 'R$' },
  pesoIni: { id: 'pesoIni', rotulo: 'Peso inicial', sufixo: 'kg' },
  pesoFin: { id: 'pesoFin', rotulo: 'Peso final', sufixo: 'kg' },
  precoVenda: { id: 'precoVenda', rotulo: 'Preço de venda', prefixo: 'R$', sufixo: '/@' },
  consumoPct: { id: 'consumoPct', rotulo: 'Consumo (% do peso vivo)', sufixo: '%' },
  precoSuplKg: { id: 'precoSuplKg', rotulo: 'Proteinado', prefixo: 'R$', sufixo: '/kg' },
  rendCarcaca: { id: 'rendCarcaca', rotulo: 'Rendimento de carcaça', sufixo: '%' },
  imposto: { id: 'imposto', rotulo: 'Imposto sobre a venda', sufixo: '%' },
  sanidadeCabMes: { id: 'sanidadeCabMes', rotulo: 'Sanidade', prefixo: 'R$', sufixo: '/cab./mês' },
  funcionario: { id: 'funcionario', rotulo: 'Funcionário', prefixo: 'R$' },
  frete: { id: 'frete', rotulo: 'Frete', prefixo: 'R$' },
};

type ItemSecao =
  | { campo: RecriaCampo }
  | { rotulo: string; valor: string; info?: InfoKey; pequeno?: string };

/** Cards na mesma divisão e ordem da planilha de recria (campos brancos = entrada; cadeado = calculado). */
function secoesRecria(r: ResultadoRecria): { titulo: string; itens: ItemSecao[] }[] {
  return [
    {
      titulo: 'Dados do lote',
      itens: [
        { campo: 'area' },
        { campo: 'dias' },
        { campo: 'investimento' },
        { campo: 'rsCabCompra' },
        {
          rotulo: 'Total de cabeças',
          info: 'cabecas',
          valor: num(r.cabecas, 2),
          pequeno: r.cabecas ? `≈ ${num(r.cabecas, 0)}` : undefined,
        },
        { campo: 'pesoIni' },
        { rotulo: 'Lotação total', info: 'lotTot', valor: comUnidade(r.lotacaoTotalUA, 2, 'UA') },
        { rotulo: 'Lotação/ha inicial', info: 'lotIni', valor: comUnidade(r.lotacaoHaInicial, 2, 'UA/ha') },
        { campo: 'pesoFin' },
        { rotulo: 'Peso médio', info: 'pesoMed', valor: comUnidade(r.pesoMedio, 2, 'kg') },
        { rotulo: 'Lotação final', info: 'lotFin', valor: comUnidade(r.lotacaoFinal, 2, 'UA/ha') },
        { rotulo: 'GMD implícito', info: 'gmd', valor: comUnidade(r.gmdImplicito, 3, 'kg/dia') },
        { campo: 'precoVenda' },
        { rotulo: 'Produzidas', info: 'arrVivo', valor: comUnidade(r.arrobasProduzidas, 2, '@') },
      ],
    },
    {
      titulo: 'Cálculo do suplemento',
      itens: [
        { campo: 'consumoPct' },
        { campo: 'precoSuplKg' },
        { rotulo: 'Consumo (peso médio × %)', info: 'consumo', valor: comUnidade(r.consumoKgDia, 3, 'kg/dia') },
        { rotulo: 'R$/cab/dia', valor: brl(r.suplCabDia) },
        { rotulo: 'R$/dia', valor: brl(r.suplDia) },
        { rotulo: 'Custo total', info: 'supl', valor: brl(r.suplTotal) },
      ],
    },
    {
      titulo: 'Cálculo do imposto',
      itens: [
        { campo: 'rendCarcaca' },
        { rotulo: '@ de carcaça por cab.', info: 'arrCarc', valor: comUnidade(r.arrobasCarcacaCab, 2, '@') },
        { rotulo: 'R$/cab (venda)', info: 'vendaCab', valor: brl(r.vendaCab) },
        { campo: 'imposto' },
        { rotulo: 'Imposto R$/cab', valor: brl(r.impostoCab) },
        { rotulo: 'Total de imposto', info: 'imp', valor: brl(r.impostoTotal) },
      ],
    },
    {
      titulo: 'Cálculo da sanidade',
      itens: [
        { campo: 'sanidadeCabMes' },
        { rotulo: 'Total de sanidade', info: 'san', valor: brl(r.sanidadeTotal) },
        { campo: 'funcionario' },
      ],
    },
    {
      titulo: 'Cálculo do custo operacional',
      itens: [
        { rotulo: 'Custo de suplemento', valor: brl(r.suplTotal) },
        { rotulo: 'Custo de sanidade', valor: brl(r.sanidadeTotal) },
        { rotulo: 'Custo de imposto', valor: brl(r.impostoTotal) },
        { campo: 'frete' },
        { rotulo: 'Custo de funcionário', valor: brl(r.custos.find((c) => c.id === 'func')?.valor ?? null) },
        { rotulo: 'Total', info: 'custo', valor: brl(r.custoTotal) },
      ],
    },
    {
      titulo: 'Faturamento',
      itens: [
        { rotulo: 'Faturamento bruto', info: 'bruto', valor: brl(r.faturamentoBruto) },
        { rotulo: 'Faturamento líquido', info: 'recLiq', valor: brl(r.faturamentoLiquido) },
        { rotulo: 'Total em caixa', info: 'caixa', valor: brl(r.totalEmCaixa) },
        { rotulo: 'Índice R$/mês', info: 'mes', valor: brl(r.liquidoMes) },
        { rotulo: 'Índice R$/ha', info: 'ha', valor: brl(r.liquidoHa) },
      ],
    },
  ];
}

const CUSTO_INFO = { supl: 'supl', san: 'san', imp: 'imp', frete: 'frete', func: 'func' } as const;

function mensagemAlerta(a: AlertaRecria): string {
  switch (a.codigo) {
    case 'cabecas_fracionadas':
      return `O investimento compra ${num(a.cabecas, 2)} cabeças (≈ ${num(a.cabecasArredondadas, 0)}). O cálculo usa o valor exato.`;
    case 'lotacao_entrada_alta':
      return `Lotação de entrada acima de ${a.limite} UA/ha.`;
    case 'lotacao_saida_alta':
      return `Lotação de saída acima de ${a.limite} UA/ha.`;
    case 'muitas_cabecas':
      return `Mais de ${a.limite} cabeças por lote.`;
  }
}

/** Percentual de um custo no total, como string para a largura da barra (só apresentação). */
function percentual(valor: Decimal | null, total: Decimal | null): Decimal | null {
  if (!valor || !total || total.isZero()) return null;
  return valor.div(total).times(100);
}

function corLiquido(v: Decimal | null): string {
  return ehNegativo(v) ? 'neg' : 'pos';
}

export type AbaRecria = 'simulador' | 'cenarios';

const ABAS: AbaRecria[] = ['simulador', 'cenarios'];

/**
 * Recria: aba Simulador (RF-030/031, entradas agrupadas e resultado fixo ao lado) e aba Cenários
 * (RF-032…RF-036).
 */
export function RecriaScreen({ abaInicial = 'simulador' }: { abaInicial?: AbaRecria }) {
  const dados = useRepoState();
  const repo = useRepo();
  const toast = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const [aba, setAba] = useState<AbaRecria>(abaInicial);
  const [nomeando, setNomeando] = useState(false);

  const recria = dados.status === 'pronto' ? dados.recria : null;
  const cenarios = dados.status === 'pronto' ? dados.cenarios : [];
  const calculada = useMemo(() => (recria ? calcularRecriaEntidade(recria) : null), [recria]);

  if (!recria || !calculada) {
    return (
      <>
        <PageHeader titulo="Cálculos Recria" />
        <Carregando />
      </>
    );
  }

  const { resultado: r, alertas } = calculada;
  const total = r.custoTotal;
  const vazios = (Object.keys(recria.form) as RecriaCampo[]).filter(
    (c) => lerCampo(recria.form[c]).tipo !== 'ok',
  );

  function salvarCenario(nome: string): void {
    if (!recria) return;
    const snapshot = snapshotDaRecria(recria, nome);
    setNomeando(false);
    if (!snapshot) {
      toast('Preencha todos os campos com números válidos para salvar o cenário.');
      return;
    }
    repo.salvarCenario(snapshot);
    setAba('cenarios');
    toast('Cenário salvo.');
  }

  function teclaNasAbas(e: KeyboardEvent<HTMLButtonElement>): void {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const proxima = ABAS[(ABAS.indexOf(aba) + 1) % ABAS.length] ?? 'simulador';
    setAba(proxima);
    document.getElementById(`aba-${proxima}`)?.focus();
  }

  const simulador = aba === 'simulador';

  return (
    <>
      <PageHeader
        titulo="Cálculos Recria"
        sub={
          simulador
            ? 'Mude os números e veja o resultado na hora.'
            : 'Seus cenários salvos. Marque até 3 para comparar.'
        }
        acoes={
          simulador ? (
            <>
              <button type="button" className="btn sec sm" onClick={() => setConfirmando(true)}>
                Limpar campos
              </button>
            </>
          ) : undefined
        }
      />

      <div className="seg abas" role="tablist" aria-label="Recria">
        {ABAS.map((id) => (
          <button
            key={id}
            id={`aba-${id}`}
            type="button"
            role="tab"
            aria-selected={aba === id}
            aria-controls="painel-recria"
            tabIndex={aba === id ? 0 : -1}
            onClick={() => setAba(id)}
            onKeyDown={teclaNasAbas}
          >
            {id === 'simulador' ? (
              'Simulador'
            ) : (
              <>
                Cenários<span className="pill-n">{cenarios.length}</span>
              </>
            )}
          </button>
        ))}
      </div>

      <div id="painel-recria" role="tabpanel" aria-labelledby={`aba-${aba}`}>
        {!simulador ? (
          <CenariosScreen
            cenarios={cenarios}
            onAbrirNoSimulador={() => setAba('simulador')}
            onIrParaSimulador={() => setAba('simulador')}
          />
        ) : (
          <div className="rgrid">
            <div className="stack">
              {secoesRecria(r).map((g, n) => (
                <section className="card" key={g.titulo} aria-labelledby={`g-recria-${n}`}>
                  <h2 id={`g-recria-${n}`}>{g.titulo}</h2>
                  <div className="row">
                    {g.itens.map((item) => {
                      if (!('campo' in item)) {
                        return (
                          <CampoCalculado
                            key={item.rotulo}
                            label={item.rotulo}
                            info={item.info}
                            valor={item.valor}
                            pequeno={item.pequeno}
                          />
                        );
                      }
                      const c = CAMPOS[item.campo];
                      const leitura = lerCampo(recria.form[c.id]);
                      return (
                        <CampoNumero
                          key={c.id}
                          inputId={`r-${c.id}`}
                          label={c.rotulo}
                          prefixo={c.prefixo}
                          sufixo={c.sufixo}
                          dataK={c.id}
                          value={recria.form[c.id]}
                          onChange={(v) => repo.atualizarRecria({ form: { [c.id]: v } })}
                          dica={dicaCampo(recria.form[c.id])}
                          invalido={leitura.tipo === 'invalido'}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="stack rres" aria-label="Resultado da recria" role="region">
              <div className="hero">
                <div className="th">
                  Faturamento líquido
                  <InfoPopover k="recLiq" />
                </div>
                <div
                  className={`big ${corLiquido(r.faturamentoLiquido)}`}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {brl(r.faturamentoLiquido)}
                </div>
                <div className="grid g3 keep3" style={{ marginTop: 16, gap: 10 }}>
                  <div className="mini">
                    <span className="th">
                      Por mês
                      <InfoPopover k="mes" />
                    </span>
                    <b aria-live="polite">{brl(r.liquidoMes, 0)}</b>
                  </div>
                  <div className="mini">
                    <span className="th">
                      Por hectare
                      <InfoPopover k="ha" />
                    </span>
                    <b aria-live="polite">{brl(r.liquidoHa, 0)}</b>
                  </div>
                  <div className="mini">
                    <span className="th">
                      Total em caixa
                      <InfoPopover k="caixa" />
                    </span>
                    <b aria-live="polite">{brl(r.totalEmCaixa, 0)}</b>
                  </div>
                </div>
                {vazios.length > 0 && (
                  <p className="hint" style={{ color: 'var(--nevoa-200)', margin: '12px 0 0' }}>
                    Preencha todos os campos com números válidos para ver o resultado completo
                    (faltam {vazios.length}).
                  </p>
                )}
              </div>

              {alertas.length > 0 && (
                <div className="alert" role="status">
                  {alertas.map((a) => (
                    <p key={a.codigo}>{mensagemAlerta(a)}</p>
                  ))}
                </div>
              )}

              <section className="card" aria-labelledby="r-custo">
                <h2 id="r-custo">
                  Custo operacional
                  <InfoPopover k="custo" />
                </h2>
                <div className="big" style={{ fontSize: 30 }} aria-live="polite">
                  {brl(r.custoTotal)}
                </div>
                <div className="cbar" style={{ marginTop: 12 }} aria-hidden="true">
                  {r.custos.map((c, k) => {
                    const p = percentual(c.valor, total);
                    return (
                      <div
                        key={c.id}
                        style={{
                          width: `${p && p.gt(0) ? p.toFixed(2) : '0'}%`,
                          background: CUSTO_CORES[k],
                        }}
                        title={c.nome}
                      />
                    );
                  })}
                </div>
                <div className="legend">
                  {r.custos.map((c, k) => {
                    const p = percentual(c.valor, total);
                    return (
                      <div key={c.id}>
                        <i style={{ background: CUSTO_CORES[k] }} aria-hidden="true" />
                        <span>
                          {c.nome}
                          <InfoPopover k={CUSTO_INFO[c.id]} />
                        </span>
                        <em>{p ? `${num(p, 1)}%` : TRACO}</em>
                        <b>{brl(c.valor)}</b>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="card" aria-labelledby="r-venda">
                <h2 id="r-venda">Da venda ao líquido</h2>
                <table>
                  <tbody>
                    <tr>
                      <td>
                        Faturamento bruto
                        <InfoPopover k="bruto" />
                      </td>
                      <td>
                        <b>{brl(r.faturamentoBruto)}</b>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        (−) Custo operacional
                        <InfoPopover k="custo" />
                      </td>
                      <td>{brl(r.custoTotal)}</td>
                    </tr>
                    <tr>
                      <td>
                        (−) Investimento
                        <InfoPopover k="invest" />
                      </td>
                      <td>{brl(recriaInvestimento(recria.form.investimento))}</td>
                    </tr>
                    <tr className="tot">
                      <td>
                        Faturamento líquido
                        <InfoPopover k="recLiq" />
                      </td>
                      <td>{brl(r.faturamentoLiquido)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <button
                type="button"
                className="btn block"
                onClick={() => {
                  if (!r.faturamentoLiquido) {
                    toast('Preencha todos os campos com números válidos para salvar o cenário.');
                    return;
                  }
                  setNomeando(true);
                }}
              >
                Salvar como cenário
              </button>
            </div>
          </div>
        )}
      </div>

      {nomeando && (
        <NomeDialog
          titulo="Salvar como cenário"
          valorInicial={`Cenário ${cenarios.length + 1}`}
          confirmar="Salvar"
          onCancel={() => setNomeando(false)}
          onConfirm={(nome) => salvarCenario(nome || `Cenário ${cenarios.length + 1}`)}
        />
      )}

      {confirmando && (
        <ConfirmDialog
          titulo="Limpar todos os campos?"
          texto='Todos os campos ficam em branco e o resultado aparece como "—" até você preencher de novo.'
          confirmar="Limpar"
          perigo
          onCancel={() => setConfirmando(false)}
          onConfirm={() => {
            repo.limparRecria();
            toast('Campos limpos.');
            setConfirmando(false);
          }}
        />
      )}
    </>
  );
}

function comUnidade(valor: Decimal | null, casas: number, unidade: string): string {
  return valor ? `${num(valor, casas)} ${unidade}` : TRACO;
}

/** Investimento digitado (ou "—"): mesma leitura estrita dos demais campos. */
function recriaInvestimento(texto: string): Decimal | null {
  const l = lerCampo(texto);
  return l.tipo === 'ok' ? l.valor : null;
}
