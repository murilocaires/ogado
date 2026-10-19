'use client';

import Link from 'next/link';
import { useState } from 'react';
import { descreverConflito, nomeDoRejeitado } from '../lib/sync/conflitos';
import type { Conflito, Rejeitado } from '../lib/sync/engine';
import { useRepo, useRepoState } from '../lib/repo/repo-provider';
import type { DadosCompletos, SyncableRepo } from '../lib/repo/types';
import { ConfirmDialog, Dialog } from './Dialog';
import { LoteModal } from './LoteModal';
import { NomeDialog } from './NomeDialog';
import { useSyncInfo } from './SyncProvider';
import { useToast } from './Toast';

const ehSincronizavel = (repo: unknown): repo is SyncableRepo =>
  typeof repo === 'object' && repo !== null && 'exportar' in repo;

/** Dados completos (inclusive excluídos) só existem no repositório sincronizável. */
function useDadosCompletos(): DadosCompletos | null {
  const repo = useRepo();
  useRepoState(); // reavalia quando o repositório muda
  return ehSincronizavel(repo) ? repo.exportar() : null;
}

/** Decisão de conflito (RF-076): os dois valores lado a lado e as duas saídas. */
export function ConflitoDialog({
  conflito,
  dados,
  onClose,
}: {
  conflito: Conflito;
  dados: DadosCompletos;
  onClose: () => void;
}) {
  const info = useSyncInfo();
  const toast = useToast();
  const d = descreverConflito(conflito, dados);

  function decidir(escolha: 'meu' | 'servidor'): void {
    info.resolver(conflito.id, escolha);
    toast(escolha === 'meu' ? 'Mantido o seu. Enviando…' : 'Valor do servidor adotado.');
    onClose();
  }

  return (
    <Dialog
      titulo={d.titulo}
      onClose={onClose}
      confirmacao
      focoInicial="[data-depois]"
      role="alertdialog"
    >
      <p style={{ margin: '0 0 12px', color: 'var(--tinta-2)', lineHeight: 1.5 }}>
        <b>{d.item}</b>: o que está neste aparelho é diferente do que está no servidor. Escolha qual
        valor vale. Nada é trocado sem a sua escolha.
      </p>
      {d.linhas.length > 0 && (
        <div className="conf-wrap">
          <table className="conf-tbl">
            <caption className="sr-only">Comparação entre o seu valor e o do servidor</caption>
            <thead>
              <tr>
                <th scope="col">Campo</th>
                <th scope="col">O seu (neste aparelho)</th>
                <th scope="col">No servidor</th>
              </tr>
            </thead>
            <tbody>
              {d.linhas.map((l) => (
                <tr key={l.rotulo} className={l.difere ? 'difere' : undefined}>
                  <th scope="row">{l.rotulo}</th>
                  <td>{l.meu}</td>
                  <td>
                    {l.servidor}
                    {l.difere && <span className="sr-only"> (diferente)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="conf-expl">
        <li>
          <b>Manter o meu:</b> {d.explicaMeu}
        </li>
        <li>
          <b>Usar o do servidor:</b> {d.explicaServidor}
        </li>
      </ul>
      <div className="actions">
        <button type="button" className="btn sec" data-depois onClick={onClose}>
          Decidir depois
        </button>
        <button type="button" className="btn sec" onClick={() => decidir('servidor')}>
          Usar o do servidor
        </button>
        <button type="button" className="btn" onClick={() => decidir('meu')}>
          Manter o meu
        </button>
      </div>
    </Dialog>
  );
}

type Acao =
  | { tipo: 'resolver'; conflito: Conflito }
  | { tipo: 'corrigir-lote'; id: string }
  | { tipo: 'corrigir-cenario'; id: string }
  | { tipo: 'excluir'; rejeitado: Rejeitado };

/**
 * "Precisa de atenção": conflitos entre aparelhos (RF-076) e itens que o servidor recusou
 * (RF-079). Nada é descartado em silêncio; cada item tem como resolver.
 */
export function AtencaoLista({ onNavegar }: { onNavegar?: () => void }) {
  const info = useSyncInfo();
  const repo = useRepo();
  const toast = useToast();
  const dados = useDadosCompletos();
  const [acao, setAcao] = useState<Acao | null>(null);

  if (!dados) return null;
  const total = info.conflitos.length + info.rejeitados.length;
  if (total === 0) {
    return (
      <p className="hint" style={{ margin: 0 }}>
        Nada precisa de atenção. Tudo o que foi lançado está sendo enviado normalmente.
      </p>
    );
  }

  const lote = (id: string) => dados.lotes.find((l) => l.id === id && l.deletedAt === null);
  const cenarioAtivo = (id: string) =>
    dados.cenarios.find((c) => c.id === id && c.deletedAt === null);

  function excluir(r: Rejeitado): void {
    if (r.tipo === 'lote') repo.excluirLote(r.id);
    else if (r.tipo === 'cenario') repo.excluirCenario(r.id);
    toast('Item excluído.');
    setAcao(null);
  }

  const loteAcao = acao?.tipo === 'corrigir-lote' ? lote(acao.id) : undefined;
  const cenarioAcao = acao?.tipo === 'corrigir-cenario' ? cenarioAtivo(acao.id) : undefined;

  return (
    <>
      <ul className="atencao-lista" aria-label="Itens que precisam de atenção">
        {info.conflitos.map((c) => {
          const d = descreverConflito(c, dados);
          return (
            <li key={`c-${c.id}`} className="atencao-item">
              <div>
                <b>{d.titulo}</b>
                <span className="hint">{d.item}</span>
              </div>
              <button
                type="button"
                className="btn sm"
                onClick={() => setAcao({ tipo: 'resolver', conflito: c })}
              >
                Resolver
              </button>
            </li>
          );
        })}
        {info.rejeitados.map((r) => {
          const nome = nomeDoRejeitado(r, dados);
          return (
            <li key={`r-${r.id}`} className="atencao-item">
              <div>
                <b>O servidor não aceitou: {nome}</b>
                <span className="hint">{r.motivo}</span>
              </div>
              <span className="atencao-acoes">
                {r.tipo === 'recria' ? (
                  <Link href="/recria" className="btn sec sm" onClick={onNavegar}>
                    Corrigir
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn sec sm"
                    onClick={() =>
                      setAcao({
                        tipo: r.tipo === 'lote' ? 'corrigir-lote' : 'corrigir-cenario',
                        id: r.id,
                      })
                    }
                  >
                    Corrigir
                  </button>
                )}
                {r.tipo !== 'recria' && (
                  <button
                    type="button"
                    className="btn danger sm"
                    onClick={() => setAcao({ tipo: 'excluir', rejeitado: r })}
                  >
                    Excluir
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {acao?.tipo === 'resolver' && (
        <ConflitoDialog conflito={acao.conflito} dados={dados} onClose={() => setAcao(null)} />
      )}
      {loteAcao && <LoteModal tipo={loteAcao.tipo} lote={loteAcao} onClose={() => setAcao(null)} />}
      {cenarioAcao && (
        <NomeDialog
          titulo="Renomear cenário"
          valorInicial={cenarioAcao.nome}
          confirmar="Renomear"
          onCancel={() => setAcao(null)}
          onConfirm={(nome) => {
            if (nome) {
              repo.renomearCenario(cenarioAcao.id, nome);
              toast('Cenário renomeado.');
            }
            setAcao(null);
          }}
        />
      )}
      {acao?.tipo === 'excluir' && (
        <ConfirmDialog
          titulo="Excluir este item?"
          texto={`${nomeDoRejeitado(acao.rejeitado, dados)} será removido deste aparelho e não será enviado. Esta ação não pode ser desfeita.`}
          confirmar="Excluir"
          perigo
          onCancel={() => setAcao(null)}
          onConfirm={() => excluir(acao.rejeitado)}
        />
      )}
    </>
  );
}

/** Lista de "Precisa de atenção" aberta a partir do indicador (qualquer tela). */
export function AtencaoDialog({ onClose }: { onClose: () => void }) {
  const info = useSyncInfo();
  const vazio = info.conflitos.length + info.rejeitados.length === 0;
  return (
    <Dialog titulo="Precisa de atenção" onClose={onClose} fecharNoFundo focoInicial="[data-fechar]">
      <AtencaoLista onNavegar={onClose} />
      <div className="actions">
        <button type="button" className="btn sec" data-fechar onClick={onClose}>
          {vazio ? 'Fechar' : 'Decidir depois'}
        </button>
      </div>
    </Dialog>
  );
}
