'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { INFO, type InfoKey } from '../lib/info';

/**
 * Ajuda contextual (RF-052): botão "i" que abre um balão com nome, explicação e "Como é calculado".
 * Fecha com Esc (devolvendo o foco ao botão), clique fora, rolagem ou redimensionamento.
 * O foco vai para o balão ao abrir, para o leitor de tela ler o conteúdo.
 */
export function InfoPopover({ k }: { k: InfoKey }) {
  const item = INFO[k];
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const balao = useRef<HTMLDivElement>(null);
  const scrollInicial = useRef(0);
  const id = useId();

  const fechar = useCallback((devolverFoco: boolean) => {
    setAberto(false);
    setPos(null);
    if (devolverFoco) botao.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!aberto || !botao.current || !balao.current) return;
    const r = botao.current.getBoundingClientRect();
    const w = balao.current.offsetWidth;
    const h = balao.current.offsetHeight;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 8);
    setPos({ left, top });
    scrollInicial.current = window.scrollY;
    balao.current.focus({ preventScroll: true });
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return;
      // Não deixa o Esc fechar também o diálogo que contém o botão.
      e.stopPropagation();
      fechar(true);
    }
    function onPointerDown(e: Event): void {
      const alvo = e.target as Node | null;
      if (alvo && (balao.current?.contains(alvo) || botao.current?.contains(alvo))) return;
      fechar(false);
    }
    function onScroll(): void {
      if (Math.abs(window.scrollY - scrollInicial.current) > 6) fechar(false);
    }
    const onResize = (): void => fechar(false);
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [aberto, fechar]);

  return (
    <>
      <button
        ref={botao}
        type="button"
        className="inf"
        aria-label={`O que é: ${item.nome}`}
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={() => (aberto ? fechar(false) : setAberto(true))}
      >
        <span aria-hidden="true">i</span>
      </button>
      {aberto &&
        createPortal(
          <div
            ref={balao}
            id={id}
            role="dialog"
            aria-label={item.nome}
            tabIndex={-1}
            className="info-pop"
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
          >
            <h4>{item.nome}</h4>
            <p>{item.texto}</p>
            {item.formula && (
              <div className="fm">
                <small>Como é calculado</small>
                {item.formula}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
