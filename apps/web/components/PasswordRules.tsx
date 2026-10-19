import { PASSWORD_RULES, type PasswordRuleId } from '@ogado/contracts';

/** Nome curto de cada requisito, para os chips (a mensagem completa fica no contrato/API). */
const ROTULO: Record<PasswordRuleId, string> = {
  minimo: '8+ caracteres',
  maximo: 'Até 128 caracteres',
  maiuscula: 'Maiúscula',
  numero: 'Número',
  simbolo: 'Símbolo',
};

export const DICA_SENHA = 'Mín. 8 caracteres, com maiúscula, número e símbolo';

/**
 * Requisitos da senha, discretos (RF-001, RF-005). Campo ainda não tocado: uma linha pequena e
 * apagada. Ao focar ou digitar: chips compactos que ficam verdes com ✓ ao serem cumpridos (o estado
 * também é dito em texto, não só por cor). Todos cumpridos: colapsa para "Senha forte ✓".
 * Só a mudança para "forte" é anunciada (região educada), para não falar a cada tecla.
 */
export function PasswordRules({
  senha,
  id,
  tocada = false,
}: {
  senha: string;
  id: string;
  /** O campo já recebeu foco? Também vale `true` se já há algo digitado. */
  tocada?: boolean;
}) {
  const regras = PASSWORD_RULES.map((rule) => ({ rule, ok: rule.ok(senha) }));
  const forte = regras.every((r) => r.ok);
  const ativa = tocada || senha !== '';

  return (
    <div id={id} className="pw-rules" data-estado={forte ? 'forte' : ativa ? 'ativo' : 'neutro'}>
      {forte ? (
        <p className="pw-linha pw-forte">
          <span className="mark" aria-hidden="true">
            ✓
          </span>
          Senha forte
        </p>
      ) : !ativa ? (
        <p className="pw-linha">
          <span className="sr-only">Requisitos da senha: </span>
          {DICA_SENHA}
        </p>
      ) : (
        <ul aria-label="Requisitos da senha" className="pw-chips">
          {regras
            .filter(({ rule, ok }) => rule.id !== 'maximo' || !ok)
            .map(({ rule, ok }) => (
              <li key={rule.id} data-ok={ok}>
                <span className="mark" aria-hidden="true">
                  {ok ? '✓' : ''}
                </span>
                <span>
                  {ROTULO[rule.id]}
                  <span className="sr-only">{ok ? ' — cumprido' : ' — pendente'}</span>
                </span>
              </li>
            ))}
        </ul>
      )}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {forte && ativa ? 'Senha forte.' : ''}
      </span>
    </div>
  );
}
