import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface Politica {
  CACHE_ESTATICO: string;
  CACHE_PAGINAS: string;
  estrategia: (req: { method: string; url: string; mode?: string }, origem: string) => string;
  podeGuardar: (r: {
    status: number;
    type?: string;
    redirected?: boolean;
    headers?: { get: (n: string) => string | null };
  }) => boolean;
  ehRotaDoProduto: (url: string) => boolean;
  chavePagina: (url: string, origem: string) => string;
  ativosDoHtml: (html: string) => string[];
}

// O arquivo é um script clássico (carregado por importScripts) dentro de um pacote ESM: avaliamos o
// código como o navegador faria, expondo `module` para recolher a API.
const codigo = readFileSync(fileURLToPath(new URL('../../public/sw-policy.js', import.meta.url)), 'utf8');
const modulo: { exports: Politica } = { exports: {} as Politica };
new Function('module', codigo)(modulo);
const P = modulo.exports;
const O = 'https://app.ogado.test';
const cab = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

describe('service worker: o que entra no cache (ADR-0007 §3, RF-071)', () => {
  it('nunca toca em /api/*, nem em métodos que não são GET', () => {
    expect(P.estrategia({ method: 'GET', url: `${O}/api/auth/session` }, O)).toBe('ignorar');
    expect(
      P.estrategia({ method: 'GET', url: `${O}/api/sync/pull?updatedSince=1`, mode: 'cors' }, O),
    ).toBe('ignorar');
    expect(P.estrategia({ method: 'GET', url: `${O}/api`, mode: 'navigate' }, O)).toBe('ignorar');
    expect(P.estrategia({ method: 'POST', url: `${O}/api/auth/login` }, O)).toBe('ignorar');
    expect(P.estrategia({ method: 'POST', url: `${O}/_next/static/a.js` }, O)).toBe('ignorar');
  });

  it('estáticos do build e fontes: cache primeiro; telas: rede com reserva', () => {
    expect(P.estrategia({ method: 'GET', url: `${O}/_next/static/chunks/a-123.js` }, O)).toBe(
      'estatico',
    );
    expect(
      P.estrategia({ method: 'GET', url: 'https://fonts.gstatic.com/s/geist.woff2' }, O),
    ).toBe('fonte');
    expect(P.estrategia({ method: 'GET', url: `${O}/recria`, mode: 'navigate' }, O)).toBe(
      'navegacao',
    );
  });

  it('ignora outras origens e requisições internas do Next (RSC, dados)', () => {
    expect(P.estrategia({ method: 'GET', url: 'https://outro.site/_next/static/a.js' }, O)).toBe(
      'ignorar',
    );
    expect(P.estrategia({ method: 'GET', url: `${O}/recria?_rsc=abc`, mode: 'cors' }, O)).toBe(
      'ignorar',
    );
  });

  it('só guarda respostas 200 sem cookie, sem redirecionamento e sem no-store', () => {
    expect(P.podeGuardar({ status: 200, headers: cab({}) })).toBe(true);
    expect(P.podeGuardar({ status: 200, headers: cab({ 'set-cookie': 'sid=1' }) })).toBe(false);
    expect(
      P.podeGuardar({ status: 200, headers: cab({ 'cache-control': 'private, no-store' }) }),
    ).toBe(false);
    expect(P.podeGuardar({ status: 200, redirected: true, headers: cab({}) })).toBe(false);
    expect(P.podeGuardar({ status: 500, headers: cab({}) })).toBe(false);
    expect(P.podeGuardar({ status: 206, headers: cab({}) })).toBe(false);
  });

  it('chave de página ignora query e barra final; só as telas do produto são guardadas', () => {
    expect(P.chavePagina(`${O}/recria/?x=1`, O)).toBe(`${O}/recria`);
    expect(P.chavePagina('/painel', O)).toBe(`${O}/painel`); // pré-carga usa caminho relativo
    expect(P.ehRotaDoProduto(`${O}/negocios?a=1`)).toBe(true);
    expect(P.ehRotaDoProduto(`${O}/nao-existe`)).toBe(false);
  });

  it('extrai os arquivos /_next/static/ citados no HTML, sem repetir', () => {
    const html =
      '<link href="/_next/static/css/x.css"/><script src="/_next/static/chunks/a.js"></script>' +
      '<script>self.__next_f.push(["/_next/static/chunks/a.js"])</script>';
    expect(P.ativosDoHtml(html)).toEqual(['/_next/static/css/x.css', '/_next/static/chunks/a.js']);
  });

  it('os caches usam o prefixo ogado- (o activate limpa por prefixo e versão)', () => {
    expect(P.CACHE_ESTATICO.startsWith('ogado-')).toBe(true);
    expect(P.CACHE_PAGINAS.startsWith('ogado-')).toBe(true);
  });
});
