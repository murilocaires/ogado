'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

/** Pilha de diálogos abertos: Esc e Tab só valem para o do topo (confirmação sobre o modal). */
const pilha: symbol[] = [];

/** Há algum diálogo aberto? (a nova versão do app não troca no meio de uma edição, RF-077) */
export function haDialogoAberto(): boolean {
  return pilha.length > 0;
}

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  titulo: string;
  onClose: () => void;
  children: ReactNode;
  role?: 'dialog' | 'alertdialog';
  estreito?: boolean;
  /** Camada acima do modal de lote (confirmações). */
  confirmacao?: boolean;
  fecharNoFundo?: boolean;
  /** Seletor do elemento que recebe o foco ao abrir (padrão: primeiro campo/botão). */
  focoInicial?: string;
}

/** Diálogo acessível: foco preso, Esc fecha o do topo, devolve o foco a quem abriu. */
export function Dialog({
  titulo,
  onClose,
  children,
  role = 'dialog',
  estreito,
  confirmacao,
  fecharNoFundo,
  focoInicial,
}: DialogProps) {
  const tituloId = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const eu = Symbol('dialog');
    const anterior = document.activeElement as HTMLElement | null;
    pilha.push(eu);
    const alvo =
      (focoInicial ? raiz.current?.querySelector<HTMLElement>(focoInicial) : null) ??
      raiz.current?.querySelector<HTMLElement>('input, textarea, select, button');
    alvo?.focus();

    function onKeyDown(e: KeyboardEvent): void {
      if (pilha[pilha.length - 1] !== eu) return;
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !raiz.current) return;
      const itens = Array.from(raiz.current.querySelectorAll<HTMLElement>(FOCAVEIS));
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (!primeiro || !ultimo) return;
      const ativo = document.activeElement;
      const fora = !raiz.current.contains(ativo);
      if (e.shiftKey && (ativo === primeiro || fora)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (ativo === ultimo || fora)) {
        e.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const i = pilha.indexOf(eu);
      if (i >= 0) pilha.splice(i, 1);
      if (anterior && document.contains(anterior)) anterior.focus();
    };
    // Só na abertura: o foco inicial não deve se repetir a cada renderização.
  }, []);

  return (
    <div
      className={`ov${confirmacao ? ' conf' : ''}`}
      onMouseDown={(e) => {
        if (fecharNoFundo && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={raiz}
        className={`modal${estreito ? ' estreito' : ''}`}
        role={role}
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <h2 id={tituloId}>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  titulo: string;
  texto: string;
  confirmar: string;
  perigo?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação antes de salvar e de excluir (RF-025, RN-024..027). */
export function ConfirmDialog({
  titulo,
  texto,
  confirmar,
  perigo,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      titulo={titulo}
      onClose={onCancel}
      role="alertdialog"
      estreito
      confirmacao
      focoInicial={perigo ? '[data-cancelar]' : '[data-confirmar]'}
    >
      <p style={{ color: 'var(--tinta-2)', margin: 0, lineHeight: 1.5 }}>{texto}</p>
      <div className="actions">
        <button type="button" className="btn sec" data-cancelar onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className={`btn${perigo ? ' danger' : ''}`}
          data-confirmar
          onClick={onConfirm}
        >
          {confirmar}
        </button>
      </div>
    </Dialog>
  );
}
