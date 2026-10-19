import { useId, useLayoutEffect, useRef, type ReactNode, type InputHTMLAttributes } from 'react';
import { valorCampo } from '../lib/format';
import { InfoPopover } from './InfoPopover';
import { Icon } from './Icon';
import type { InfoKey } from '../lib/info';

interface CampoNumeroProps {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  prefixo?: string;
  sufixo?: string;
  dica?: string | null;
  invalido?: boolean;
  dataK?: string;
  inputId?: string;
  casas?: number;
  mascara?: boolean;
}

/** Edicao somente de digitos, preservando a posicao do cursor ao agrupar milhares. */
function ParteNumero({
  value,
  onValue,
  agrupar = false,
  limite,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  value: string;
  onValue: (texto: string) => void;
  agrupar?: boolean;
  limite?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);
  const exibido = agrupar ? value.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : value;
  useLayoutEffect(() => {
    if (cursor.current !== null) {
      ref.current?.setSelectionRange(cursor.current, cursor.current);
      cursor.current = null;
    }
  });
  const atualizar = (texto: string, posicao: number) => {
    const digitos = texto.replace(/\D/g, '');
    if (limite !== undefined && digitos.length > limite) return;
    const limpo = agrupar ? digitos.replace(/^0+(?=\d)/, '') : digitos;
    const formatado = agrupar ? limpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : limpo;
    let pos = formatado.length;
    for (let n = texto.slice(posicao).replace(/\D/g, '').length; pos > 0 && n > 0;) {
      if (/\d/.test(formatado[--pos]!)) n--;
    }
    cursor.current = pos;
    onValue(limpo);
  };
  return (
    <input
      {...props}
      ref={ref}
      value={exibido}
      inputMode="numeric"
      autoComplete="off"
      onKeyDown={(e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key.length === 1 && !/^\d$/.test(e.key)) e.preventDefault();
        const el = e.currentTarget;
        const inicio = el.selectionStart ?? 0;
        if (inicio !== el.selectionEnd) return;
        if (e.key === 'Backspace' && exibido[inicio - 1] === '.')
          el.setSelectionRange(inicio - 1, inicio - 1);
        if (e.key === 'Delete' && exibido[inicio] === '.')
          el.setSelectionRange(inicio + 1, inicio + 1);
      }}
      onBeforeInput={(e) => {
        const data = (e.nativeEvent as InputEvent).data;
        if (data && !/^\d+$/.test(data)) e.preventDefault();
      }}
      onPaste={(e) => {
        e.preventDefault();
        const texto = e.clipboardData.getData('text');
        if (!/^\d+$/.test(texto)) return;
        const inicio = e.currentTarget.selectionStart ?? 0;
        const fim = e.currentTarget.selectionEnd ?? inicio;
        atualizar(exibido.slice(0, inicio) + texto + exibido.slice(fim), inicio + texto.length);
      }}
      onChange={(e) => atualizar(e.target.value, e.target.selectionStart ?? e.target.value.length)}
    />
  );
}

/** Parte inteira e fracao separadas, sem deslocar a escala durante a digitacao. */
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
  const numero = valorCampo(value);
  const [inteiro = '', fracao = ''] = numero ? value.replace(/\./g, '').split(',') : ['', ''];
  const acessibilidade = {
    'aria-invalid': invalido || undefined,
    'aria-describedby': dica ? dicaId : undefined,
  } as const;
  return (
    <div className="lbl">
      <label htmlFor={id}>{label}</label>
      <div className="fld" data-invalid={invalido ? 'true' : undefined}>
        {prefixo && <span aria-hidden="true">{prefixo}</span>}
        {mascara ? (
          <>
            <ParteNumero
              {...acessibilidade}
              id={id}
              data-k={dataK}
              agrupar
              value={inteiro}
              onValue={(v) => onChange(v === '' ? '' : v + (fracao ? `,${fracao}` : ''))}
            />
            {casas > 0 && (
              <>
                <span aria-hidden="true">,</span>
                <ParteNumero
                  {...acessibilidade}
                  className="numero-fracao"
                  aria-label={`${label} - decimais`}
                  value={fracao}
                  limite={casas}
                  placeholder={'0'.repeat(casas)}
                  onValue={(v) => onChange(v ? `${inteiro || '0'},${v}` : inteiro)}
                />
              </>
            )}
          </>
        ) : (
          <input
            {...acessibilidade}
            id={id}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            data-k={dataK}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
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
