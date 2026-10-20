'use client';

import { useEffect, useRef, useState } from 'react';
import { CENARIO_NOME_MAX } from '../lib/repo/types';
import { Dialog } from './Dialog';

interface NomeDialogProps {
  titulo: string;
  valorInicial: string;
  onConfirm: (nome: string) => void;
  onCancel: () => void;
  label?: string;
  placeholder?: string;
  confirmar?: string;
  erro?: string;
  ocupado?: boolean;
}

/** Pede o nome do cenário (salvar e renomear): máx. 80, Enter confirma, Esc cancela. */
export function NomeDialog({
  titulo,
  valorInicial,
  onConfirm,
  onCancel,
  label = 'Nome do cenário',
  placeholder = 'ex.: Safra 26/27 — preço otimista',
  confirmar = 'Confirmar',
  erro,
  ocupado = false,
}: NomeDialogProps) {
  const [nome, setNome] = useState(valorInicial);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campo.current?.select();
  }, []);

  return (
    <Dialog
      titulo={titulo}
      onClose={ocupado ? () => undefined : onCancel}
      estreito
      fecharNoFundo
      focoInicial="#nome-in"
    >
      <div className="lbl">
        <label htmlFor="nome-in">{label}</label>
        <div className="fld">
          <input
            id="nome-in"
            ref={campo}
            maxLength={CENARIO_NOME_MAX}
            value={nome}
            placeholder={placeholder}
            autoComplete="off"
            disabled={ocupado}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !ocupado) {
                e.preventDefault();
                onConfirm(nome.trim());
              }
            }}
          />
        </div>
      </div>
      {erro && <p role="alert">{erro}</p>}
      <div className="actions" aria-busy={ocupado}>
        <button type="button" className="btn sec" onClick={onCancel} disabled={ocupado}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => onConfirm(nome.trim())}
          disabled={ocupado}
        >
          {confirmar}
        </button>
      </div>
    </Dialog>
  );
}
