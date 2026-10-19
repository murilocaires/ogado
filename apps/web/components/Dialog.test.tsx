// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog trava a rolagem da página', () => {
  it('com um diálogo aberto só ele rola; ao fechar a página volta ao normal', () => {
    const a = render(
      <Dialog titulo="A" onClose={() => undefined}>
        <button type="button">ok</button>
      </Dialog>,
    );
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');

    // um segundo diálogo (confirmação) não solta a trava ao fechar antes do primeiro
    const b = render(
      <Dialog titulo="B" onClose={() => undefined} confirmacao>
        <button type="button">ok</button>
      </Dialog>,
    );
    b.unmount();
    expect(document.documentElement.style.overflow).toBe('hidden');

    a.unmount();
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('');
  });
});
