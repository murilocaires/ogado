import { z } from 'zod';

/**
 * Versão vigente dos Termos de Uso e da Política de Privacidade (`docs/legal/*`), no formato
 * AAAA-MM-DD (a mesma "Versão" do cabeçalho dos dois arquivos). Mudou o texto ou o tratamento de
 * dados pessoais? Suba esta versão, atualize `TERMOS_MANIFESTO` e peça novo aceite (RNF-009).
 */
export const TERMOS_VERSAO = '2026-10-21';

/**
 * SHA-256 (hex) dos arquivos `docs/legal/*.md` (fim de linha normalizado para LF) na versão acima.
 * `termos.test.ts` falha se o conteúdo mudar sem que a versão e estes hashes sejam atualizados.
 */
export const TERMOS_MANIFESTO = {
  versao: TERMOS_VERSAO,
  arquivos: {
    'termos-de-uso.md': 'fd6730725f3b21ab519f52c5a429ace019bd70b08323388bca6e7a8df59d6ffe',
    'politica-de-privacidade.md':
      '633c8f84efb056b5518ed4c9f5de7250f502c71d9158c6424f4256ab01c5e750',
  },
} as const;

/** POST /conta/aceite: o cliente informa a versão que o usuário viu; só a vigente é aceita. */
export const aceiteRequestSchema = z.strictObject({
  versao: z.string({ error: 'Informe a versão dos termos.' }).min(1).max(32),
});
export type AceiteRequest = z.infer<typeof aceiteRequestSchema>;

export const ACEITE_TERMOS_OBRIGATORIO =
  'Aceite os Termos de Uso e a Política de Privacidade para criar a conta.';
