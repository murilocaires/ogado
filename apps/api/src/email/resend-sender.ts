import type { EmailSender } from './email-sender';

export const RESEND_URL = 'https://api.resend.com/emails';

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface ResendOptions {
  apiKey: string;
  from: string;
  /** Injetável nos testes. */
  fetch?: FetchLike;
  timeoutMs?: number;
}

/** Adaptador Resend via fetch. Em erro rejeita só com o status HTTP (o corpo pode ter dados sensíveis). */
export function createResendEmailSender(options: ResendOptions): EmailSender {
  const doFetch: FetchLike = options.fetch ?? ((url, init) => fetch(url, init));
  return {
    async send(message) {
      const response = await doFetch(RESEND_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: options.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
      });
      if (!response.ok) throw new Error(`Resend respondeu HTTP ${response.status}`);
    },
  };
}
