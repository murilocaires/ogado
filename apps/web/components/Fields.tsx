import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { num, valorCampo } from '../lib/format';
import { InfoPopover } from './InfoPopover';
import { Icon } from './Icon';
import type { InfoKey } from '../lib/info';

interface CampoNumeroProps {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  prefixo?: string;
  sufixo?: string;
  /** Dica/erro mostrado sob o campo (vazio exigido, vírgula etc.). */
  dica?: string | null;
  /** `true` quando a dica é erro (campo inválido). */
  invalido?: boolean;
  dataK?: string;
  inputId?: string;
  casas?: number;
  mascara?: boolean;
}

/** Campo BRANCO: o usuário preenche (pt-BR, só vírgula decimal). */
export function CampoNumero({
  label,
  value,
  onChange,
  prefixo,
  sufixo,
  dica,
  invalido,
  dataK,
  inputId,
  casas = 2,
  mascara = false,
}: CampoNumeroProps) {
  const gerado = useId();
  const id = inputId ?? gerado;
  const dicaId = `${id}-dica`;
  const input = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);
  const numero = valorCampo(value);
  const exibido = mascara && numero ? num(numero, casas) : value;
  useLayoutEffect(() => {
    if (cursor.current !== null) {
      input.current?.setSelectionRange(cursor.current, cursor.current);
      cursor.current = null;
    }
  });
  const atualizar = (texto: string, posicao: number) => {
    const digitos = texto.replace(/\D/g, '');
    const direita = texto.slice(posicao).replace(/\D/g, '').length;
    const limpo = digitos.replace(/^0+(?=\d)/, '');
    const preenchido = limpo.padStart(casas + 1, '0');
    const inteiro = casas ? preenchido.slice(0, -casas) : preenchido;
    const formatado =
      digitos === ''
        ? ''
        : inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.') +
          (casas ? `,${preenchido.slice(-casas)}` : '');
    let novaPosicao = formatado.length;
    for (let restantes = direita; novaPosicao > 0 && restantes > 0;) {
      if (/\d/.test(formatado[--novaPosicao]!)) restantes--;
    }
    cursor.current = novaPosicao;
    onChange(casas === 0 ? formatado.replace(/\./g, '') : formatado);
  };
  return (
    <div className="lbl">
      <label htmlFor={id}>{label}</label>
      <div className="fld" data-invalid={invalido ? 'true' : undefined}>
        {prefixo && <span aria-hidden="true">{prefixo}</span>}
        <input
          ref={input}
          id={id}
          inputMode={mascara ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={exibido}
          data-k={dataK}
          aria-invalid={invalido || undefined}
          aria-describedby={dica ? dicaId : undefined}
          onKeyDown={(e) => {
            if (!mascara) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key.length === 1 && !/^\d$/.test(e.key)) e.preventDefault();
            const el = e.currentTarget;
            const inicio = el.selectionStart ?? 0;
            const fim = el.selectionEnd ?? inicio;
            if (inicio !== fim) return;
            if (e.key === 'Backspace' && /[.,]/.test(exibido[inicio - 1] ?? '')) {
              el.setSelectionRange(inicio - 1, inicio - 1);
            }
            if (e.key === 'Delete' && /[.,]/.test(exibido[inicio] ?? '')) {
              el.setSelectionRange(inicio + 1, inicio + 1);
            }
          }}
          onBeforeInput={(e) => {
            if (!mascara) return;
            const data = (e.nativeEvent as InputEvent).data;
            if (data && !/^\d+$/.test(data)) e.preventDefault();
          }}
          onPaste={(e) => {
            if (!mascara) return;
            e.preventDefault();
            const texto = e.clipboardData.getData('text');
            if (!/^\d+$/.test(texto)) return;
            const el = e.currentTarget;
            const inicio = el.selectionStart ?? 0;
            const fim = el.selectionEnd ?? inicio;
            atualizar(exibido.slice(0, inicio) + texto + exibido.slice(fim), inicio + texto.length);
          }}
          onChange={(e) =>
            mascara
              ? atualizar(e.target.value, e.target.selectionStart ?? e.target.value.length)
              : onChange(e.target.value)
          }
        />
        {sufixo && <span aria-hidden="true">{sufixo}</span>}
      </div>
      <span id={dicaId} className={invalido ? 'err' : 'hint'} aria-live="polite">
        {dica ?? ''}
      </span>
    </div>
  );
}

interface CampoCalculadoProps {
  label: string;
  valor: string;
  pequeno?: string;
  info?: InfoKey;
}

/** Campo MENTA com cadeado: calculado, somente leitura (RF-051). */
export function CampoCalculado({ label, valor, pequeno, info }: CampoCalculadoProps) {
  const id = useId();
  return (
    <div className="lbl">
      <span id={id}>
        {label}
        {info && <InfoPopover k={info} />}
      </span>
      <div className="calc" role="group" aria-labelledby={id}>
        <Icon name="lock" size={16} />
        <output>{valor}</output>
        {pequeno && <small>{pequeno}</small>}
      </div>
    </div>
  );
}

export function Th({ children, info }: { children: ReactNode; info?: InfoKey }) {
  return (
    <span className="th">
      {children}
      {info && <InfoPopover k={info} />}
    </span>
  );
}
