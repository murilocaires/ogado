'use client';

import { calcularCompra, calcularVenda, type ModoPeso } from '@ogado/domain';
import { useId, useMemo, useState } from 'react';
import { brl, capitalizar, num, numCompacto } from '../lib/format';
import {
  CATEGORIAS_SUGERIDAS,
  errosDoRascunho,
  mudarCategoria,
  modosGuardados,
  novoRascunho,
  pesoDoModo,
  previaPronta,
  rascunhoDeLote,
  rascunhoParaDominio,
  validarRascunho,
  type LoteDraft,
} from '../lib/lote-draft';
import { pesosValidos, proximoNumero, separarPesos } from '../lib/negocios';
import { useRepo, useRepoState } from '../lib/repo/repo-provider';
import type { LoteEntity, LoteTipo } from '../lib/repo/types';
import { ConfirmDialog, Dialog } from './Dialog';
import { CampoCalculado, CampoNumero } from './Fields';
import { useToast } from './Toast';

interface Props {
  /** Tipo do lançamento novo, definido pelo botão que abriu o modal (ignorado na edição). */
  tipo: LoteTipo;
  lote?: LoteEntity;
  onClose: () => void;
}

const MODOS: { modo: ModoPeso; rotulo: string }[] = [
  { modo: 'total', rotulo: 'Total do lote' },
  { modo: 'medio', rotulo: 'Média × qtd.' },
  { modo: 'individual', rotulo: 'Peso a peso' },
];

/** Modal de lote (RF-025, RF-026, RF-022, RN-027): novo ou edição, com confirmação ao salvar. */
export function LoteModal({ tipo, lote, onClose }: Props) {
  const repo = useRepo();
  const dados = useRepoState();
  const toast = useToast();
  const lotes = dados.status === 'pronto' ? dados.lotes : [];
  const novo = !lote;

  const [d, setD] = useState<LoteDraft>(() =>
    lote ? rascunhoDeLote(lote) : novoRascunho(tipo, proximoNumero(lotes, tipo)),
  );
  const [confirmando, setConfirmando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');
  const listaId = useId();
  const pesosId = useId();

  const venda = d.tipo === 'venda';
  const erros = useMemo(() => errosDoRascunho(d), [d]);
  const erroDe = (campo: string): string | null => erros.find((e) => e.campo === campo)?.mensagem ?? null;
  const guardados = modosGuardados(d);

  const linha = useMemo(() => {
    const entrada = rascunhoParaDominio(d);
    return venda ? calcularVenda(entrada) : calcularCompra(entrada);
  }, [d, venda]);
  const pronta = previaPronta(d, linha);
  const chips = useMemo(() => pesosValidos(separarPesos(d.pesosTxt)), [d.pesosTxt]);

  function atualizar(parcial: Partial<LoteDraft>): void {
    setErroSalvar('');
    setD((atual) => ({ ...atual, ...parcial }));
  }

  function pedirConfirmacao(): void {
    const r = validarRascunho(d);
    if (!r.ok) {
      setErroSalvar(r.mensagem);
      return;
    }
    setErroSalvar('');
    setConfirmando(true);
  }

  function salvar(): void {
    const r = validarRascunho(d);
    if (!r.ok) {
      setConfirmando(false);
      setErroSalvar(r.mensagem);
      return;
    }
    repo.salvarLote(r.lote);
    toast(novo ? 'Lote salvo.' : 'Alterações salvas.');
    setConfirmando(false);
    onClose();
  }

  const qtdConfirmacao = num(linha.qtd, 0);
  const descricaoLote = `${d.numero} de ${capitalizar(d.categoria.trim().toUpperCase() || 'SEM CATEGORIA')} (${qtdConfirmacao} cab.)`;
  const rotuloPeso = d.modo === 'medio' ? 'Peso médio por cabeça' : 'Peso total do lote';
  const infoPeso = venda ? 'arrV' : 'arrC';

  return (
    <>
      <Dialog
        titulo={novo ? `Nova ${d.tipo}` : `Editar lote de ${d.tipo}`}
        onClose={onClose}
        fecharNoFundo
        focoInicial="#d-cat"
      >
        <div className="stack">
          <div className="row">
            <div className="lbl">
              <label htmlFor="d-cat">Categoria</label>
              <div className="fld">
                <input
                  id="d-cat"
                  list={listaId}
                  value={d.categoria}
                  onChange={(e) => {
                    setErroSalvar('');
                    setD((a) => mudarCategoria(a, e.target.value));
                  }}
                />
              </div>
              <datalist id={listaId}>
                {CATEGORIAS_SUGERIDAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="lbl">
              <label htmlFor="d-data">Data</label>
              <div className="fld">
                <input
                  id="d-data"
                  type="date"
                  value={d.data}
                  onChange={(e) => atualizar({ data: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="th" style={{ marginBottom: 6 }} id="d-modo-rotulo">
              Como informar o peso
            </div>
            <div className="seg g" role="tablist" aria-labelledby="d-modo-rotulo">
              {MODOS.map((m) => (
                <button
                  key={m.modo}
                  type="button"
                  role="tab"
                  aria-selected={d.modo === m.modo}
                  onClick={() => atualizar({ modo: m.modo })}
                >
                  {m.rotulo}
                  {guardados.includes(m.modo) && (
                    <>
                      <i className="dot" aria-hidden="true" />
                      <span className="sr-only"> (tem um valor guardado)</span>
                    </>
                  )}
                </button>
              ))}
            </div>
            <div className="hint" style={{ marginTop: 6 }}>
              {guardados.length
                ? 'Só o modo selecionado entra no cálculo. O que você digitou nos outros modos (●) fica guardado e não se perde ao trocar de aba.'
                : 'Você pode alternar entre os modos sem perder o que digitou.'}
            </div>
          </div>

          {d.modo === 'individual' ? (
            <div className="lbl">
              <label htmlFor={pesosId}>Pesos, um por animal (kg)</label>
              <textarea
                id={pesosId}
                placeholder="Um peso por linha"
                value={d.pesosTxt}
                aria-invalid={erroDe('pesos') ? true : undefined}
                onChange={(e) => atualizar({ pesosTxt: e.target.value })}
              />
              <span className={erroDe('pesos') ? 'err' : 'hint'} aria-live="polite">
                {erroDe('pesos') ??
                  'Aceita linhas, ponto e vírgula ou vírgula seguida de espaço. A quantidade vira o nº de pesos.'}
              </span>
              {chips.length > 0 && (
                <ul className="chips" aria-label="Pesos informados" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {chips.slice(0, 40).map((p, i) => (
                    <li key={i} className="chip">
                      {numCompacto(p)} kg
                    </li>
                  ))}
                  {chips.length > 40 && <li className="chip">+{chips.length - 40}</li>}
                </ul>
              )}
            </div>
          ) : (
            <div className="row">
              <CampoNumero
                label="Quantidade"
                inputId="d-qtd"
                value={d.qtd}
                sufixo="cab."
                onChange={(v) => atualizar({ qtd: v })}
                dica={erroDe('qtd')}
                invalido={!!erroDe('qtd')}
              />
              <CampoNumero
                label={rotuloPeso}
                inputId="d-peso"
                value={pesoDoModo(d)}
                sufixo="kg"
                onChange={(v) => atualizar(d.modo === 'medio' ? { pesoMedio: v } : { pesoTotal: v })}
                dica={erroDe('peso')}
                invalido={!!erroDe('peso')}
              />
            </div>
          )}

          {venda && (
            <>
              <div>
                <div className="th" style={{ marginBottom: 6 }} id="d-base-rotulo">
                  Base do preço da arroba
                </div>
                <div className="seg g" role="group" aria-labelledby="d-base-rotulo">
                  <button
                    type="button"
                    aria-pressed={d.base === 'vivo'}
                    onClick={() => atualizar({ base: 'vivo' })}
                  >
                    Peso vivo (@ de 30 kg)
                  </button>
                  <button
                    type="button"
                    aria-pressed={d.base === 'carcaca'}
                    onClick={() => atualizar({ base: 'carcaca' })}
                  >
                    Carcaça (@ de 15 kg)
                  </button>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <label className="chk">
                    <input
                      type="checkbox"
                      id="d-desc"
                      checked={d.aplicarDesconto}
                      onChange={(e) =>
                        atualizar({ aplicarDesconto: e.target.checked, descontoTocado: true })
                      }
                    />
                    Aplicar desconto de
                  </label>
                  <span className="pct">
                    <input
                      id="d-pct"
                      inputMode="decimal"
                      value={d.descontoKg}
                      disabled={!d.aplicarDesconto}
                      aria-label="Desconto (kg por cabeça)"
                      aria-invalid={erroDe('desconto') ? true : undefined}
                      onChange={(e) => atualizar({ descontoKg: e.target.value })}
                    />
                    kg por cabeça
                  </span>
                  <span className="hint">descontados do peso (fêmeas; desmarque para machos)</span>
                </div>
                {erroDe('desconto') && (
                  <span className="err" role="alert">
                    {erroDe('desconto')}
                  </span>
                )}
              </div>
            </>
          )}

          <CampoNumero
            label="Preço da arroba"
            inputId="d-preco"
            value={d.preco}
            prefixo="R$"
            sufixo="/@"
            onChange={(v) => atualizar({ preco: v })}
            dica={erroDe('preco')}
            invalido={!!erroDe('preco')}
          />

          <div className="grid g3" style={{ gap: 10 }} role="group" aria-live="polite" aria-label="Pré-visualização do lote">
            <CampoCalculado
              label="Cabeças"
              info="cabLote"
              valor={linha.qtd.gt(0) ? num(linha.qtd, 0) : '—'}
            />
            <CampoCalculado
              label="Peso"
              info={infoPeso}
              valor={pronta.peso ? `${num(linha.arrobas, 2)} @` : '—'}
              pequeno={
                pronta.peso
                  ? linha.kgDescontado.gt(0) && venda
                    ? `${num(linha.kgLiquido, 0)} kg líq.`
                    : `${num(linha.kg, 0)} kg`
                  : undefined
              }
            />
            <CampoCalculado label="Total" info="totalLote" valor={pronta.total ? brl(linha.total) : '—'} />
          </div>

          {!pronta.total && !erroSalvar && (
            <p className="hint" style={{ margin: 0 }}>
              Preencha quantidade, peso e preço da arroba para ver o total.
            </p>
          )}

          {erroSalvar && (
            <div className="err" role="alert">
              {erroSalvar}
            </div>
          )}

          <div className="actions">
            <button type="button" className="btn sec" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn" onClick={pedirConfirmacao}>
              Salvar lote
            </button>
          </div>
        </div>
      </Dialog>
      {confirmando && (
        <ConfirmDialog
          titulo={novo ? 'Salvar novo lote?' : 'Salvar alterações?'}
          texto={
            novo
              ? `O lote ${descricaoLote} será adicionado às ${d.tipo === 'compra' ? 'compras' : 'vendas'}.`
              : `As alterações do lote ${descricaoLote} serão aplicadas e os totais recalculados.`
          }
          confirmar="Salvar"
          onConfirm={salvar}
          onCancel={() => setConfirmando(false)}
        />
      )}
    </>
  );
}

