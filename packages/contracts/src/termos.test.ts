import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TERMOS_MANIFESTO, TERMOS_VERSAO } from './termos';

const pasta = join(dirname(fileURLToPath(import.meta.url)), '../../../docs/legal');

function lerNormalizado(nome: string): string {
  return readFileSync(join(pasta, nome), 'utf8').replace(/\r\n/g, '\n');
}

function sha256(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}

describe('RNF-009 consentimento versionado (TERMOS_VERSAO)', () => {
  it('a versão é uma data AAAA-MM-DD válida e igual à do manifesto', () => {
    expect(TERMOS_VERSAO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(TERMOS_VERSAO))).toBe(false);
    expect(TERMOS_MANIFESTO.versao).toBe(TERMOS_VERSAO);
  });

  it.each(Object.keys(TERMOS_MANIFESTO.arquivos))(
    'docs/legal/%s traz a versão vigente no cabeçalho',
    (nome) => {
      expect(lerNormalizado(nome)).toContain(`**Versão ${TERMOS_VERSAO}**`);
    },
  );

  it.each(Object.entries(TERMOS_MANIFESTO.arquivos))(
    'docs/legal/%s não mudou sem subir a versão e o hash (atualize TERMOS_VERSAO e TERMOS_MANIFESTO em packages/contracts/src/termos.ts)',
    (nome, hashRegistrado) => {
      expect(sha256(lerNormalizado(nome))).toBe(hashRegistrado);
    },
  );

  it.each(Object.keys(TERMOS_MANIFESTO.arquivos))(
    'docs/legal/%s mantém os marcadores explícitos do controlador e o aviso de rascunho',
    (nome) => {
      const texto = lerNormalizado(nome);
      expect(texto).toContain('[E-MAIL DE CONTATO DO CONTROLADOR — preencher]');
      expect(texto).toContain('[IDENTIFICAÇÃO DO CONTROLADOR — preencher]');
      expect(texto).toMatch(/Rascunho/);
    },
  );
});
