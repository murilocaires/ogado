'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COMPARAR_MAX,
  decimalDe,
  diferenca,
  idsMelhores,
  filtrarOrdenar,
  LINHAS_COMPARACAO,
  liquidoDe,
  percentualCusto,
  pesoInicialFinal,
  type OrdemCenarios,
} from '../lib/cenarios';
import { CUSTO_CORES } from '../lib/custo-cores';
import { baixarArquivo, gerarArquivo } from '../lib/exportacao/baixar';
import { tabelaDeCenarios } from '../lib/exportacao/dados';
import { brl, dataBR, ehNegativo, num, valorCampo } from '../lib/format';
import { aguardarGravacao } from '../lib/persistencia';
import { useRepo } from '../lib/repo/repo-provider';
import type { CenarioEntity } from '../lib/repo/types';
import { ConfirmDialog } from './Dialog';
import { ExportarDialog } from './ExportarDialog';
import { Icon } from './Icon';
import { InfoPopover } from './InfoPopover';
import { NomeDialog } from './NomeDialog';
import { SeloSync } from './SyncIndicador';
import { useToast } from './Toast';

type Visao = 'lista' | 'grade';

interface CenariosScreenProps {
  cenarios: readonly CenarioEntity[];
  /** Chamado depois de carregar o cenário no simulador (troca para a aba Simulador). */
  onAbrirNoSimulador: () => void;
  onIrParaSimulador: () => void;
}

/** Data do cenário (ISO completo) como `dd/mm/aaaa`. */
function dataDoCenario(c: CenarioEntity): string {
  return dataBR(c.criadoEm.slice(0, 10));
}

function Estrela() {
  return (
    <span className="estrela" role="img" aria-label="Melhor líquido" title="Melhor líquido">
      ★
    </span>
  );
}

function BarraCustos({ c }: { c: CenarioEntity }) {
  return (
    <div className="mb hm" aria-hidden="true">
      {c.resultado.custos.map((k, i) => (
        <div
          key={k.id}
          style={{ width: `${percentualCusto(c, k.valor)}%`, background: CUSTO_CORES[i] }}
        />
      ))}
    </div>
  );
}

/** Cenários salvos (RF-032…RF-036): lista/grade, busca, ordenação, ações e comparação. */
export function CenariosScreen({
  cenarios,
  onAbrirNoSimulador,
  onIrParaSimulador,
}: CenariosScreenProps) {
  const repo = useRepo();
  const toast = useToast();
  const [visao, setVisao] = useState<Visao>('lista');
  const [ordem, setOrdem] = useState<OrdemCenarios>('recentes');
  const [busca, setBusca] = useState('');
  const [marcados, setMarcados] = useState<string[]>([]);
  const [comparando, setComparando] = useState(false);
  const [renomeando, setRenomeando] = useState<CenarioEntity | null>(null);
  const [excluindo, setExcluindo] = useState<CenarioEntity | null>(null);
  const [exportando, setExportando] = useState(false);
  const painelComparacao = useRef<HTMLElement>(null);
  const copiasPendentes = useRef(new Set<string>());
  const duplicando = useRef(new Set<string>());

  // Cenário excluído (ou duplicado em outra aba) sai da seleção.
  const ids = useMemo(() => new Set(cenarios.map((c) => c.id)), [cenarios]);
  const melhores = useMemo(() => idsMelhores(cenarios), [cenarios]);
  const selecionados = marcados.filter((id) => ids.has(id));
  const visiveis = useMemo(() => filtrarOrdenar(cenarios, busca, ordem), [cenarios, busca, ordem]);
  const comparaveis = selecionados
    .map((id) => cenarios.find((c) => c.id === id))
    .filter((c): c is CenarioEntity => c !== undefined);
  const mostrarComparacao = comparando && comparaveis.length >= 2;

  useEffect(() => {
    if (mostrarComparacao)
      painelComparacao.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [mostrarComparacao]);

  if (cenarios.length === 0) {
    return (
      <div className="card empty">
        <h3>Nenhum cenário salvo</h3>
        <p>Monte uma simulação no Simulador e salve para comparar com outras.</p>
        <button type="button" className="btn" onClick={onIrParaSimulador}>
          Ir para o Simulador
        </button>
      </div>
    );
  }

  function alternar(c: CenarioEntity): void {
    if (selecionados.includes(c.id)) {
      const resto = selecionados.filter((id) => id !== c.id);
      setMarcados(resto);
      if (resto.length < 2) setComparando(false);
      return;
    }
    if (selecionados.length >= COMPARAR_MAX) {
      toast(`Compare até ${COMPARAR_MAX} cenários.`);
      return;
    }
    setMarcados([...selecionados, c.id]);
  }

  async function abrir(c: CenarioEntity): Promise<void> {
    try {
      repo.atualizarRecria({
        form: c.form,
        lotacaoInicial: c.variantes.lotacaoInicial,
        variantes: c.variantes,
        parametros: c.parametros,
      });
      await aguardarGravacao(repo);
      toast(`Cenário "${c.nome}" aberto no simulador.`);
      onAbrirNoSimulador();
    } catch {
      toast('Não foi possível gravar o simulador no aparelho. Tente novamente.');
    }
  }

  async function duplicar(c: CenarioEntity): Promise<void> {
    if (duplicando.current.has(c.id)) return;
    duplicando.current.add(c.id);
    try {
      if (!copiasPendentes.current.has(c.id)) {
        if (!repo.duplicarCenario(c.id)) return;
        copiasPendentes.current.add(c.id);
      }
      await aguardarGravacao(repo);
      copiasPendentes.current.delete(c.id);
      toast('Cenário duplicado.');
    } catch {
      toast('Não foi possível gravar a cópia no aparelho. Tente novamente.');
    } finally {
      duplicando.current.delete(c.id);
    }
  }

  const contagem = `${visiveis.length} ${visiveis.length === 1 ? 'cenário' : 'cenários'}${busca.trim() ? ' encontrados' : ''}`;

  function cor(c: CenarioEntity): string {
    return ehNegativo(liquidoDe(c)) ? 'txt-neg' : 'txt-pos';
  }

  function checkbox(c: CenarioEntity) {
    return (
      <label className="chk-alvo">
        <input
          type="checkbox"
          checked={selecionados.includes(c.id)}
          onChange={() => alternar(c)}
          aria-label={`Comparar ${c.nome}`}
        />
      </label>
    );
  }

  return (
    <>
      <div className="tb">
        <label className="fld">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="Buscar cenário"
            aria-label="Buscar cenário"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        <select
          aria-label="Ordenar"
          value={ordem}
          onChange={(e) => setOrdem(e.target.value as OrdemCenarios)}
        >
          <option value="recentes">Mais recentes</option>
          <option value="liquido">Maior líquido</option>
          <option value="nome">Nome (A–Z)</option>
        </select>
        <div className="vt" role="group" aria-label="Visualização">
          <button
            type="button"
            aria-pressed={visao === 'lista'}
            aria-label="Lista"
            title="Lista"
            onClick={() => setVisao('lista')}
          >
            <Icon name="list" size={20} />
          </button>
          <button
            type="button"
            aria-pressed={visao === 'grade'}
            aria-label="Grade"
            title="Grade"
            onClick={() => setVisao('grade')}
          >
            <Icon name="grid" size={20} />
          </button>
        </div>
        <button type="button" className="btn sec sm" onClick={() => setExportando(true)}>
          <Icon name="baixar" size={18} />
          Exportar
        </button>
        <span className="hint tb-count" aria-live="polite">
          {contagem}
        </span>
      </div>

      {mostrarComparacao && (
        <section className="card cmp-card" ref={painelComparacao} aria-labelledby="cmp-titulo">
          <div className="cmp-head">
            <h2 id="cmp-titulo">Comparação</h2>
            <button type="button" className="btn sec sm" onClick={() => setComparando(false)}>
              Fechar
            </button>
          </div>
          <div className="cmp-wrap">
            <table className="cmp">
              <thead>
                <tr>
                  <th scope="col">Indicador</th>
                  {comparaveis.map((c) => (
                    <th scope="col" key={c.id}>
                      {c.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LINHAS_COMPARACAO.slice(0, 9).map((linha) => linhaComparacao(linha))}
                <tr>
                  <th scope="row" className="cmp-rotulo">
                    Peso inicial → final
                  </th>
                  {comparaveis.map((c) => (
                    <td key={c.id}>{pesoInicialFinal(c)}</td>
                  ))}
                </tr>
                {LINHAS_COMPARACAO.slice(9).map((linha) => linhaComparacao(linha))}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ margin: '12px 0 0' }}>
            ★ melhor faturamento líquido. As diferenças são em relação ao primeiro cenário marcado;
            verde = melhor, vermelho = pior.
          </p>
        </section>
      )}

      {visiveis.length === 0 ? (
        <div className="card empty" style={{ padding: 30 }}>
          <h3 style={{ fontSize: 19 }}>Nada encontrado</h3>
          <p style={{ margin: 0 }}>Nenhum cenário com “{busca.trim()}”.</p>
        </div>
      ) : visao === 'grade' ? (
        <div className="cgrid" role="list">
          {visiveis.map((c) => {
            const r = c.resultado;
            const on = selecionados.includes(c.id);
            return (
              <article className={`gc${on ? ' sel' : ''}`} key={c.id} role="listitem">
                <div className="t">
                  <b>
                    {c.nome}
                    <SeloSync id={c.id} />
                    {melhores.has(c.id) && (
                      <>
                        {' '}
                        <Estrela />
                      </>
                    )}
                  </b>
                  {checkbox(c)}
                </div>
                <div className={`v ${cor(c)}`}>{brl(decimalDe(r.faturamentoLiquido), 0)}</div>
                <BarraCustos c={c} />
                <div className="f">
                  <span>
                    {brl(decimalDe(r.liquidoMes), 0)}/mês · {num(valorCampo(c.form.dias), 0)}d
                  </span>
                  <span className="acts">
                    <button
                      type="button"
                      className="icon-b"
                      title="Abrir no simulador"
                      aria-label={`Abrir ${c.nome}`}
                      onClick={() => abrir(c)}
                    >
                      <Icon name="open" size={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-b"
                      title="Excluir"
                      aria-label={`Excluir ${c.nome}`}
                      onClick={() => setExcluindo(c)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="clist" role="list">
          <div className="crow h" aria-hidden="true">
            <span />
            <span>Cenário</span>
            <span className="n">Líquido</span>
            <span className="n hm">Por mês</span>
            <span className="n hm">Por ha</span>
            <span className="n hm">Dias</span>
            <span className="n hm">R$/@</span>
            <span className="hm">Custos</span>
            <span />
          </div>
          {visiveis.map((c) => {
            const r = c.resultado;
            const on = selecionados.includes(c.id);
            return (
              <div className={`crow${on ? ' sel' : ''}`} key={c.id} role="listitem">
                {checkbox(c)}
                <div className="nm2">
                  <b>
                    {c.nome}
                    <SeloSync id={c.id} />
                    {melhores.has(c.id) && (
                      <>
                        {' '}
                        <Estrela />
                      </>
                    )}
                  </b>
                  <span>{dataDoCenario(c)}</span>
                </div>
                <span className={`liq ${cor(c)}`}>{brl(decimalDe(r.faturamentoLiquido), 0)}</span>
                <span className="n hm">{brl(decimalDe(r.liquidoMes), 0)}</span>
                <span className="n hm">{brl(decimalDe(r.liquidoHa), 0)}</span>
                <span className="n hm">{num(valorCampo(c.form.dias), 0)}</span>
                <span className="n hm">{num(valorCampo(c.form.precoVenda), 0)}</span>
                <BarraCustos c={c} />
                <div className="acts">
                  <button
                    type="button"
                    className="icon-b"
                    title="Abrir no simulador"
                    aria-label={`Abrir ${c.nome}`}
                    onClick={() => abrir(c)}
                  >
                    <Icon name="open" size={18} />
                  </button>
                  <button
                    type="button"
                    className="icon-b hd"
                    title="Duplicar"
                    aria-label={`Duplicar ${c.nome}`}
                    onClick={() => duplicar(c)}
                  >
                    <Icon name="copy" size={18} />
                  </button>
                  <button
                    type="button"
                    className="icon-b hd"
                    title="Renomear"
                    aria-label={`Renomear ${c.nome}`}
                    onClick={() => setRenomeando(c)}
                  >
                    <Icon name="edit" size={18} />
                  </button>
                  <button
                    type="button"
                    className="icon-b"
                    title="Excluir"
                    aria-label={`Excluir ${c.nome}`}
                    onClick={() => setExcluindo(c)}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selecionados.length > 0 && (
        <div className="cbar2" role="region" aria-label="Comparação">
          <span aria-live="polite">
            {selecionados.length} selecionado{selecionados.length > 1 ? 's' : ''}
            {selecionados.length < 2 ? ' · marque mais 1' : ''}
          </span>
          {selecionados.length >= 2 && (
            <button type="button" className="btn" onClick={() => setComparando(true)}>
              {mostrarComparacao ? 'Atualizar comparação' : 'Comparar'}
            </button>
          )}
          <button
            type="button"
            className="lk"
            onClick={() => {
              setMarcados([]);
              setComparando(false);
            }}
          >
            Limpar
          </button>
        </div>
      )}

      {exportando && (
        <ExportarDialog<'todos'>
          titulo="Exportar cenários"
          conteudos={[{ id: 'todos', rotulo: 'Todos os cenários', quantidade: cenarios.length }]}
          conteudoInicial="todos"
          onClose={() => setExportando(false)}
          onExportar={async (formato) => {
            const arquivo = await gerarArquivo(formato, [tabelaDeCenarios(cenarios)], 'cenarios');
            baixarArquivo(arquivo);
            return `Arquivo ${arquivo.nome} baixado.`;
          }}
        />
      )}

      {renomeando && (
        <NomeDialog
          titulo="Renomear cenário"
          valorInicial={renomeando.nome}
          confirmar="Renomear"
          onCancel={() => setRenomeando(null)}
          onConfirm={async (nome) => {
            try {
              if (nome) {
                repo.renomearCenario(renomeando.id, nome);
                await aguardarGravacao(repo);
                toast('Cenário renomeado.');
              }
              setRenomeando(null);
            } catch {
              toast('Não foi possível gravar o nome no aparelho. Tente novamente.');
            }
          }}
        />
      )}

      {excluindo && (
        <ConfirmDialog
          titulo="Excluir cenário?"
          texto={`“${excluindo.nome}” será removido. Esta ação não pode ser desfeita.`}
          confirmar="Excluir"
          perigo
          onCancel={() => setExcluindo(null)}
          onConfirm={async () => {
            try {
              repo.excluirCenario(excluindo.id);
              await aguardarGravacao(repo);
              toast('Cenário excluído.');
              setExcluindo(null);
            } catch {
              toast('Não foi possível gravar a exclusão no aparelho. Tente novamente.');
            }
          }}
        />
      )}
    </>
  );

  function linhaComparacao(linha: (typeof LINHAS_COMPARACAO)[number]) {
    const base = comparaveis[0] ? linha.valor(comparaveis[0]) : null;
    const melhor = linha.estrela
      ? comparaveis.reduce<ReturnType<typeof linha.valor>>((m, c) => {
          const v = linha.valor(c);
          return v && (!m || v.gt(m)) ? v : m;
        }, null)
      : null;
    return (
      <tr key={linha.id}>
        <th scope="row" className="cmp-rotulo">
          {linha.rotulo}
          {linha.info && <InfoPopover k={linha.info} />}
        </th>
        {comparaveis.map((c, k) => {
          const v = linha.valor(c);
          const dif = k > 0 ? diferenca(linha, v, base) : null;
          const destaque = !!melhor && !!v && v.eq(melhor);
          return (
            <td key={c.id} className={destaque ? 'best' : undefined}>
              {linha.formatar(v)}
              {destaque && (
                <>
                  {' '}
                  <Estrela />
                </>
              )}
              {dif && (
                <small
                  className={dif.tom === 'melhor' ? 'up' : dif.tom === 'pior' ? 'dn' : undefined}
                >
                  {dif.texto}
                  {dif.tom !== 'neutra' && (
                    <span className="sr-only"> {dif.tom === 'melhor' ? '(melhor)' : '(pior)'}</span>
                  )}
                </small>
              )}
            </td>
          );
        })}
      </tr>
    );
  }
}
