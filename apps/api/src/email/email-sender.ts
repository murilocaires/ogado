/** E-mail transacional simples, só texto (sem HTML nem rastreadores). */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Fronteira de saída de e-mail. Rejeita quando o provedor falha; o chamador decide o que fazer. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
