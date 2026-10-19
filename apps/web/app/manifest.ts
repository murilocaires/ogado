import type { MetadataRoute } from 'next';

/** Manifest do app instalável (RF-070, ADR-0007 §1). Cores = floresta-950 e pasto-400 dos tokens. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'O Gado',
    short_name: 'O Gado',
    description: 'Gestão de pecuária: Compra e Venda e Recria',
    lang: 'pt-BR',
    dir: 'ltr',
    start_url: '/painel',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#08241a',
    theme_color: '#08241a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
