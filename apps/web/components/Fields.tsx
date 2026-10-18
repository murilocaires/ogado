import { useId, type ReactNode } from 'react';
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
}: CampoNumeroProps) {
  const gerado = useId();
  const id = inputId ?? gerado;
  const dicaId = `${id}-dica`;
  return (
    <div className="lbl">
      <label htmlFor={id}>{label}</label>
      <div className="fld" data-invalid={invalido ? 'true' : undefined}>
        {prefixo && <span aria-hidden="true">{prefixo}</span>}
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          data-k={dataK}
          aria-invalid={invalido || undefined}
          aria-describedby={dica ? dicaId : undefined}
          onChange={(e) => onChange(e.target.value)}
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
