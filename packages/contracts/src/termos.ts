import { z } from 'zod';

/**
 * Versão vigente dos Termos de Uso e da Política de Privacidade (`docs/legal/*`), no formato
 * AAAA-MM-DD (a mesma "Versão" do cabeçalho dos dois arquivos). Mudou o texto ou o tratamento de
 * dados pessoais? Suba esta versão, atualize `TERMOS_MANIFESTO` e peça novo aceite (RNF-009).
 */
export const TERMOS_VERSAO = '2026-10-20';

/**
 * SHA-256 (hex) dos arquivos `docs/legal/*.md` (fim de linha normalizado para LF) na versão acima.
 * `termos.test.ts` falha se o conteúdo mudar sem que a versão e estes hashes sejam atualizados.
 */
export const TERMOS_MANIFESTO = {
  versao: TERMOS_VERSAO,
  arquivos: {
    'termos-de-uso.md': '60ac53267ca9303ee2f0f2b03bdeb008c087da67293f2f1f08e5b45627b7905c',
    'politica-de-privacidade.md':
      'a31181c5430d6ebb7e21e9101abc1113c70a1903256c0f1c48326303d5f1cd2d',
  },
} as const;

/** POST /conta/aceite: o cliente informa a versão que o usuário viu; só a vigente é aceita. */
export const aceiteRequestSchema = z.strictObject({
  versao: z.string({ error: 'Informe a versão dos termos.' }).min(1).max(32),
});
export type AceiteRequest = z.infer<typeof aceiteRequestSchema>;

export const ACEITE_TERMOS_OBRIGATORIO =
  'Aceite os Termos de Uso e a Política de Privacidade para criar a conta.';
