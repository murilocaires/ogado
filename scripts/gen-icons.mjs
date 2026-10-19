// Gera os ícones do app (E4) a partir da marca de apps/web/components/Logo.tsx.
// Usa o Chromium/Edge do Playwright já instalado (sem dependência nova):
//   node scripts/gen-icons.mjs        (E2E_CHANNEL=chrome|msedge|"" para escolher o navegador)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(raiz, 'apps', 'web');
const { chromium } = createRequire(join(web, 'package.json'))('@playwright/test');

// Tokens: --floresta-950 (styles/globals.css) e --pasto-400 (styles/tokens.css).
const FLORESTA = '#08241a';
const PASTO = '#B5E05A';

/** Marca do Logo.tsx. `fundo`: 'arredondado' (any), 'cheio' (maskable/apple); `escala` encolhe a marca. */
function svg(tamanho, fundo, escala) {
  const rx = fundo === 'arredondado' ? 18 : 0;
  const t = (64 * (1 - escala)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${rx}" fill="${FLORESTA}"/>
  <g transform="translate(${t} ${t}) scale(${escala})">
    <circle cx="32" cy="40" r="12" fill="none" stroke="${PASTO}" stroke-width="7"/>
    <path d="M23.5 31.5C13 31 9 21 13 13" fill="none" stroke="${PASTO}" stroke-width="6" stroke-linecap="round"/>
    <path d="M40.5 31.5C51 31 55 21 51 13" fill="none" stroke="${PASTO}" stroke-width="6" stroke-linecap="round"/>
  </g>
</svg>`;
}

const icones = [
  { arquivo: 'icon-192.png', tamanho: 192, fundo: 'arredondado', escala: 1 },
  { arquivo: 'icon-512.png', tamanho: 512, fundo: 'arredondado', escala: 1 },
  // Maskable: a marca cabe no círculo de segurança (80% do lado), então fica a 62%.
  { arquivo: 'icon-maskable-512.png', tamanho: 512, fundo: 'cheio', escala: 0.62 },
  // iOS arredonda sozinho: quadrado cheio, marca um pouco menor.
  { arquivo: 'apple-touch-icon.png', tamanho: 180, fundo: 'cheio', escala: 0.78 },
];

const saida = join(web, 'public', 'icons');
mkdirSync(saida, { recursive: true });

const canal = process.env.E2E_CHANNEL ?? 'msedge';
const navegador = await chromium.launch({ channel: canal || undefined });
try {
  for (const i of icones) {
    const pagina = await navegador.newPage({ viewport: { width: i.tamanho, height: i.tamanho } });
    await pagina.setContent(
      `<body style="margin:0;background:transparent">${svg(i.tamanho, i.fundo, i.escala)}</body>`,
    );
    const png = await pagina.screenshot({ omitBackground: true, type: 'png' });
    writeFileSync(join(saida, i.arquivo), png);
    await pagina.close();
    console.log('gerado', i.arquivo);
  }
} finally {
  await navegador.close();
}
