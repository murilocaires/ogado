'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useOptionalSessionController } from '../lib/auth/session-provider';
import { aguardarGravacao } from '../lib/persistencia';
import { nomeDoRejeitado } from '../lib/sync/conflitos';
import type { Rejeitado } from '../lib/sync/engine';
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

type Acao =
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
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const executando = useRef(false);
  const controller = useOptionalSessionController();

  if (!dados) return null;
  const total = info.conflitos.length + info.rejeitados.length;
  if (total === 0 && acao === null) {
    return (
      <p className="hint" style={{ margin: 0 }}>
        Nada precisa de atenção. Tudo o que foi lançado está sendo enviado normalmente.
      </p>
    );
  }

  const lote = (id: string) => dados.lotes.find((l) => l.id === id && l.deletedAt === null);
  const cenarioAtivo = (id: string) =>
    dados.cenarios.find((c) => c.id === id && c.deletedAt === null);

  function abrirAcao(nova: Acao) {
    setErro('');
    setAcao(nova);
  }

  async function confirmar(trabalho: () => void | Promise<void>, mensagem: string): Promise<void> {
    if (executando.current) return;
    executando.current = true;
    setOcupado(true);
    setErro('');
    const origem = controller?.getState();
    const exigirSessao = () => {
      if (!controller || !origem) return;
      const atual = controller.getState();
      if (
        origem.status === 'autenticado' &&
        atual.status === 'autenticado' &&
        origem.usuario.id === atual.usuario.id &&
        origem.fazenda.id === atual.fazenda.id &&
        !controller.getAccountMismatch()
      )
        return;
      if (origem.status !== 'autenticado' && atual === origem) return;
      throw new Error('sessao_alterada');
    };
    try {
      exigirSessao();
      await trabalho();
      exigirSessao();
      toast(mensagem);
      setAcao(null);
    } catch {
      setErro(
        'Não foi possível confirmar a alteração. Mantenha esta tela aberta e tente novamente.',
      );
    } finally {
      executando.current = false;
      setOcupado(false);
    }
  }

  function excluir(r: Rejeitado): void {
    void confirmar(async () => {
      const existe =
        r.tipo === 'lote'
          ? dados?.lotes.some((l) => l.id === r.id)
          : dados?.cenarios.some((c) => c.id === r.id);
      if (!existe && r.original !== undefined) {
        if (!info.excluirRejeitado) throw new Error('exclusao_indisponivel');
        await info.excluirRejeitado(r);
        return;
      }
      if (!existe) throw new Error('item_nao_encontrado');
      if (r.tipo === 'lote') repo.excluirLote(r.id);
      else if (r.tipo === 'cenario') repo.excluirCenario(r.id);
      else throw new Error('item_invalido');
      await aguardarGravacao(repo);
    }, 'Item excluído.');
  }

  const loteAcao = acao?.tipo === 'corrigir-lote' ? lote(acao.id) : undefined;
  const cenarioAcao = acao?.tipo === 'corrigir-cenario' ? cenarioAtivo(acao.id) : undefined;

  return (
    <>
      <ul className="atencao-lista" aria-label="Itens que precisam de atenção">
        {info.rejeitados.map((r) => {
          const nome = nomeDoRejeitado(r, dados);
          const editavel = r.tipo === 'lote' ? Boolean(lote(r.id)) : Boolean(cenarioAtivo(r.id));
          return (
            <li key={`r-${r.id}`} className="atencao-item">
              <div>
                <b>O servidor não aceitou: {nome}</b>
                <span className="hint">{r.motivo}</span>
                {!editavel && r.original !== undefined && (
                  <span className="hint">
                    Os dados originais estão preservados no aparelho. Este item não pode ser aberto
                    para correção.
                  </span>
                )}
              </div>
              <span className="atencao-acoes">
                {r.tipo === 'recria' ? (
                  <Link href="/recria" className="btn sec sm" onClick={onNavegar}>
                    Corrigir
                  </Link>
                ) : editavel ? (
                  <button
                    type="button"
                    className="btn sec sm"
                    onClick={() =>
                      abrirAcao({
                        tipo: r.tipo === 'lote' ? 'corrigir-lote' : 'corrigir-cenario',
                        id: r.id,
                      })
                    }
                  >
                    Corrigir
                  </button>
                ) : null}
                {r.tipo !== 'recria' && (
                  <button
                    type="button"
                    className="btn danger sm"
                    onClick={() => abrirAcao({ tipo: 'excluir', rejeitado: r })}
                  >
                    Excluir
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {loteAcao && <LoteModal tipo={loteAcao.tipo} lote={loteAcao} onClose={() => setAcao(null)} />}
      {cenarioAcao && (
        <NomeDialog
          titulo="Renomear cenário"
          valorInicial={cenarioAcao.nome}
          confirmar="Renomear"
          erro={erro}
          ocupado={ocupado}
          onCancel={() => setAcao(null)}
          onConfirm={(nome) => {
            if (nome)
              void confirmar(async () => {
                repo.renomearCenario(cenarioAcao.id, nome);
                await aguardarGravacao(repo);
              }, 'Cenário renomeado.');
            else setAcao(null);
          }}
        />
      )}
      {acao?.tipo === 'excluir' && (
        <ConfirmDialog
          titulo="Excluir este item?"
          texto={
            acao.rejeitado.original !== undefined
              ? `${nomeDoRejeitado(acao.rejeitado, dados)} será excluído da nuvem e deixará de aparecer em Precisa de atenção. Esta ação não pode ser desfeita.`
              : `${nomeDoRejeitado(acao.rejeitado, dados)} será excluído. A alteração será sincronizada quando houver conexão. Esta ação não pode ser desfeita.`
          }
          confirmar="Excluir"
          perigo
          erro={erro}
          ocupado={ocupado}
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
