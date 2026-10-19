import { PASSWORD_RULES } from '@ogado/contracts';

/** Lista de requisitos da senha, marcados em tempo real (RF-001, RF-005). */
export function PasswordRules({ senha, id }: { senha: string; id: string }) {
  const titleId = `${id}-titulo`;
  return (
    <div id={id} className="pw-rules">
      <p id={titleId} className="title" style={{ margin: 0 }}>
        Requisitos da senha
      </p>
      <ul aria-labelledby={titleId} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {PASSWORD_RULES.filter((rule) => rule.id !== 'maximo' || !rule.ok(senha)).map((rule) => {
          const ok = rule.ok(senha);
          return (
            <li key={rule.id} data-ok={ok}>
              <span className="mark" aria-hidden="true">
                {ok ? '✓' : ''}
              </span>
              <span>
                {rule.mensagem}
                <span className="sr-only">{ok ? ' — cumprido' : ' — pendente'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
