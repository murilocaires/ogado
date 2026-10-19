import type { EmailMessage } from './email-sender';

/** E-mail com a cópia dos dados do titular (RNF-009): só texto, o JSON vai como anexo. */
export function dadosPorEmail(
  to: string,
  anexo: { filename: string; content: string },
): EmailMessage {
  return {
    to,
    subject: 'Seus dados no O Gado',
    text: [
      'Olá!',
      '',
      'Você pediu uma cópia dos seus dados no O Gado. Ela está no arquivo em anexo (formato JSON).',
      'O arquivo traz seu perfil, sua fazenda, seus lotes e seus cenários não excluídos.',
      '',
      'Se você não fez esse pedido, troque a sua senha em Conta e fale conosco.',
    ].join('\n'),
    attachments: [anexo],
  };
}
