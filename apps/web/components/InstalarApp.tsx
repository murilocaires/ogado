'use client';

import { useState } from 'react';
import { pedirInstalacao, useOpcaoInstalacao } from '../lib/pwa/instalacao';
import { Dialog } from './Dialog';

/**
 * Botão "Instalar o app" (RF-070). Chrome/Edge/Android: prompt nativo. iPhone/iPad: instruções
 * "Compartilhar > Adicionar à Tela de Início". Já instalado, ou sem suporte: não aparece.
 */
export function InstalarApp({ className = 'btn' }: { className?: string }) {
  const opcao = useOpcaoInstalacao();
  const [instrucoes, setInstrucoes] = useState(false);

  if (opcao === 'nenhuma') return null;

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          if (opcao === 'ios') setInstrucoes(true);
          else void pedirInstalacao();
        }}
      >
        Instalar o app
      </button>
      {instrucoes && (
        <Dialog
          titulo="Instalar o Bovaro no iPhone ou iPad"
          onClose={() => setInstrucoes(false)}
          estreito
          fecharNoFundo
        >
          <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.7, color: 'var(--tinta-2)' }}>
            <li>
              Abra este endereço no <b>Safari</b>.
            </li>
            <li>
              Toque em <b>Compartilhar</b> (o quadrado com a seta para cima).
            </li>
            <li>
              Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.
            </li>
          </ol>
          <p style={{ margin: '12px 0 0', color: 'var(--tinta-2)', fontSize: 14, lineHeight: 1.5 }}>
            Depois disso o Bovaro abre em tela cheia e funciona mesmo sem internet.
          </p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => setInstrucoes(false)}>
              Entendi
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
