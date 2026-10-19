import { z } from 'zod';

/**
 * Versão vigente dos Termos de Uso e da Política de Privacidade (`docs/legal/*`), no formato
 * AAAA-MM-DD (a mesma "Versão" do cabeçalho dos dois arquivos). Mudou o texto ou o tratamento de
 * dados pessoais? Suba esta versão, atualize `TERMOS_MANIFESTO` e peça novo aceite (RNF-009).
 */
export const TERMOS_VERSAO = '2026-10-19';

/**
 * SHA-256 (hex) dos arquivos `docs/legal/*.md` (fim de linha normalizado para LF) na versão acima.
 * `termos.test.ts` falha se o conteúdo mudar sem que a versão e estes hashes sejam atualizados.
 */
export const TERMOS_MANIFESTO = {
  versao: TERMOS_VERSAO,
  arquivos: {
    'termos-de-uso.md': 'af999f888837d6526705f0706dbb6450f4ea05d227c87deaa6f27d89a4cab900',
    'politica-de-privacidade.md':
      'b53e2b509790b5c487012dc425e856a2548df7573b8a85582fb53a51f2236274',
  },
} as const;

/** POST /conta/aceite: o cliente informa a versão que o usuário viu; só a vigente é aceita. */
export const aceiteRequestSchema = z.strictObject({
  versao: z.string({ error: 'Informe a versão dos termos.' }).min(1).max(32),
});
export type AceiteRequest = z.infer<typeof aceiteRequestSchema>;

export const ACEITE_TERMOS_OBRIGATORIO =
  'Aceite os Termos de Uso e a Política de Privacidade para criar a conta.';
