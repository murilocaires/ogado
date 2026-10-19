import type { EmailMessage, EmailSender } from './email-sender';

export interface MemoryEmailSender extends EmailSender {
  readonly sent: readonly EmailMessage[];
  last(): EmailMessage | undefined;
}

/** Adaptador de dev/test: guarda os e-mails em memória; nada sai do processo. */
export function createMemoryEmailSender(): MemoryEmailSender {
  const sent: EmailMessage[] = [];
  return {
    sent,
    last: () => sent[sent.length - 1],
    send(message) {
      sent.push(message);
      return Promise.resolve();
    },
  };
}

/**
 * Produção sem provedor configurado: a API sobe, avisa uma vez e descarta o e-mail. Nunca registra
 * destinatário nem conteúdo (o corpo traz o token de redefinição).
 */
export function createUnconfiguredEmailSender(warn: (mensagem: string) => void): EmailSender {
  let avisado = false;
  return {
    send() {
      if (!avisado) {
        avisado = true;
        warn(
          'RESEND_API_KEY/EMAIL_FROM não configurados: e-mails (ex.: recuperação de senha) NÃO estão sendo enviados.',
        );
      }
      return Promise.resolve();
    },
  };
}
