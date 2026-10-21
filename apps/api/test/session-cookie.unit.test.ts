import { describe, expect, it } from 'vitest';
import { readSessionToken } from '../src/session/cookie';

describe('session cookie rebrand compatibility', () => {
  it('prefers the Bovaro cookie and accepts the legacy Ogado cookie during transition', () => {
    expect(readSessionToken({ bovaro_session: 'novo' }, { production: false })).toBe('novo');
    expect(readSessionToken({ ogado_session: 'legado' }, { production: false })).toBe('legado');
  });

  it('reads the legacy __Host cookie in production without changing cookie policy', () => {
    expect(readSessionToken({ '__Host-ogado_session': 'legado' }, { production: true })).toBe(
      'legado',
    );
  });
});
