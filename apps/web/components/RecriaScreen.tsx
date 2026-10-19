'use client';

import type { AlertaRecria, Decimal } from '@ogado/domain';
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
import { InfoPopover } from './InfoPopover';
import { NomeDialog } from './NomeDialog';
import { useToast } from './Toast';

interface CampoDef {
  id: RecriaCampo;
  rotulo: string;
  prefixo?: string;
  sufixo?: string;
}

const GRUPOS: { titulo: string; campos: CampoDef[] }[] = [
  {
    titulo: 'Lote e área',
    campos: [
      { id: 'area', rotulo: 'Área pastável', sufixo: 'ha' },
      { id: 'dias', rotulo: 'Dias de recria', sufixo: 'dias' },
      { id: 'investimento', rotulo: 'Investimento', prefixo: 'R$' },
      { id: 'rsCabCompra', rotulo: 'R$ por cabeça (compra)', prefixo: 'R$' },
      { id: 'pesoIni', rotulo: 'Peso inicial', sufixo: 'kg' },
      { id: 'pesoFin', rotulo: 'Peso final', sufixo: 'kg' },
      { id: 'precoVenda', rotulo: 'Preço de venda', prefixo: 'R$', sufixo: '/@' },
    ],
  },
  {
    titulo: 'Suplemento',
    campos: [
      { id: 'consumoPct', rotulo: 'Consumo (% do peso vivo)', sufixo: '%' },
      { id: 'precoSuplKg', rotulo: 'Proteinado', prefixo: 'R$', sufixo: '/kg' },
    ],
  },
  {
    titulo: 'Imposto e sanidade',
    campos: [
      { id: 'rendCarcaca', rotulo: 'Rendimento de carcaça', sufixo: '%' },
      { id: 'imposto', rotulo: 'Imposto sobre a venda', sufixo: '%' },
      { id: 'sanidadeCabMes', rotulo: 'Sanidade', prefixo: 'R$', sufixo: '/cab./mês' },
    ],
  },
  {
    titulo: 'Outros custos',
    campos: [
      { id: 'funcionario', rotulo: 'Funcionário', prefixo: 'R$' },
      { id: 'frete', rotulo: 'Frete', prefixo: 'R$' },
    ],
  },
];

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
              {GRUPOS.map((g) => (
                <section className="card" key={g.titulo} aria-labelledby={`g-${g.titulo}`}>
                  <h2 id={`g-${g.titulo}`}>{g.titulo}</h2>
                  <div className="row">
                    {g.campos.map((c) => {
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

              <section className="card" aria-labelledby="r-numeros">
                <h2 id="r-numeros">Números do lote</h2>
                <div className="grid g2" style={{ gap: 12 }}>
                  <CampoCalculado
                    label="Cabeças"
                    info="cabecas"
                    valor={num(r.cabecas, 2)}
                    pequeno={r.cabecas ? `≈ ${num(r.cabecas, 0)}` : undefined}
                  />
                  <CampoCalculado
                    label="Lotação total"
                    info="lotTot"
                    valor={comUnidade(r.lotacaoTotalUA, 2, 'UA')}
                  />
                  <CampoCalculado
                    label="Lotação inicial"
                    info="lotIni"
                    valor={comUnidade(r.lotacaoHaInicial, 2, 'UA/ha')}
                  />
                  <CampoCalculado
                    label="Lotação final"
                    info="lotFin"
                    valor={comUnidade(r.lotacaoFinal, 2, 'UA/ha')}
                  />
                  <CampoCalculado
                    label="Peso médio"
                    info="pesoMed"
                    valor={comUnidade(r.pesoMedio, 0, 'kg')}
                  />
                  <CampoCalculado
                    label="GMD implícito"
                    info="gmd"
                    valor={comUnidade(r.gmdImplicito, 3, 'kg/dia')}
                  />
                  <CampoCalculado
                    label="@ na venda (peso vivo)"
                    info="arrVivo"
                    valor={comUnidade(r.arrobasProduzidas, 2, '@')}
                  />
                  <CampoCalculado
                    label="@ de carcaça por cabeça"
                    info="arrCarc"
                    valor={comUnidade(r.arrobasCarcacaCab, 2, '@')}
                  />
                  <CampoCalculado
                    label="Consumo por cabeça"
                    info="consumo"
                    valor={comUnidade(r.consumoKgDia, 3, 'kg/dia')}
                  />
                  <CampoCalculado
                    label="Venda por cabeça"
                    info="vendaCab"
                    valor={brl(r.vendaCab)}
                  />
                </div>
                <p className="hint" style={{ margin: '12px 0 0' }}>
                  Campos com cadeado são calculados e não podem ser editados.
                </p>
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
