import type { EmailMessage } from './email-sender';

/** Texto do e-mail de redefinição (pt-BR, só texto, sem imagens nem links de rastreio). */
export function passwordResetEmail(to: string, link: string): EmailMessage {
  return {
    to,
    subject: 'Redefinir sua senha no O Gado',
    text: [
      'Olá!',
      '',
      'Recebemos um pedido para redefinir a senha da sua conta no O Gado.',
      'Para escolher uma nova senha, abra o link abaixo (vale por 1 hora e só pode ser usado uma vez):',
      '',
      link,
      '',
      'Se você não fez esse pedido, ignore este e-mail: a sua senha continua a mesma.',
    ].join('\n'),
  };
}
