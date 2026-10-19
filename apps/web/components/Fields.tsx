import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
} from 'react';
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
  dica?: string | null;
  invalido?: boolean;
  dataK?: string;
  inputId?: string;
  casas?: number;
  mascara?: boolean;
}

/** Um campo com virgula opcional e agrupamento automatico de milhares. */
function NumeroFormatado({
  value,
  onValue,
  casas,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  value: string;
  onValue: (texto: string) => void;
  casas: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);
  const [rascunho, setRascunho] = useState<string | null>(null);
  const numero = valorCampo(value);
  const exibido = rascunho ?? (numero ? num(numero, casas) : value);
  useLayoutEffect(() => {
    if (cursor.current !== null) {
      ref.current?.setSelectionRange(cursor.current, cursor.current);
      cursor.current = null;
    }
  });
  const atualizar = (texto: string, posicao: number) => {
    const limpo = texto.replace(/\./g, '');
    const valido = casas > 0 ? /^\d*(,\d*)?$/.test(limpo) : /^\d*$/.test(limpo);
    if (!valido) return;
    const [inteiro = '', fracao = ''] = limpo.split(',');
    if (fracao.length > casas) return;
    const parte = inteiro.replace(/^0+(?=\d)/, '') || (limpo.includes(',') ? '0' : '');
    const formatado =
      parte.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (limpo.includes(',') ? `,${fracao}` : '');
    let pos = formatado.length;
    for (let n = texto.slice(posicao).replace(/\./g, '').length; pos > 0 && n > 0;) {
      if (formatado[--pos] !== '.') n--;
    }
    cursor.current = pos;
    setRascunho(formatado);
    onValue(parte + (limpo.includes(',') ? `,${fracao || '0'}` : ''));
  };
  return (
    <input
      {...props}
      ref={ref}
      value={exibido}
      inputMode={casas ? 'decimal' : 'numeric'}
      autoComplete="off"
      onFocus={() => {
        // Zeros decimais sao opcionais enquanto o usuario edita.
        setRascunho(numero ? num(numero, casas).replace(/,0+$/, '') : value);
      }}
      onBlur={() => {
        const atual = valorCampo(value);
        setRascunho(null);
        if (atual) onValue(casas ? num(atual, casas) : atual.toFixed(0));
      }}
      onKeyDown={(e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key.length === 1 && !(casas ? /^[\d,]$/ : /^\d$/).test(e.key)) e.preventDefault();
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
        if (data && !(casas ? /^[\d,]+$/ : /^\d+$/).test(data)) e.preventDefault();
      }}
      onPaste={(e) => {
        e.preventDefault();
        const texto = e.clipboardData.getData('text');
        if (!(casas ? /^\d+(,\d*)?$/ : /^\d+$/).test(texto)) return;
        const inicio = e.currentTarget.selectionStart ?? 0;
        const fim = e.currentTarget.selectionEnd ?? inicio;
        atualizar(exibido.slice(0, inicio) + texto + exibido.slice(fim), inicio + texto.length);
      }}
      onChange={(e) => atualizar(e.target.value, e.target.selectionStart ?? e.target.value.length)}
    />
  );
}

/** Campo numerico com virgula opcional e zeros completados ao sair. */
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
          <NumeroFormatado
            {...acessibilidade}
            id={id}
            data-k={dataK}
            value={value}
            casas={casas}
            onValue={onChange}
          />
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
