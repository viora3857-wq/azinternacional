import { AppError } from '../../lib/errors';
import type { EmailMessage, EmailProvider } from './email.types';

/** Envio transacional pela API v3 da Brevo. */
export class BrevoProvider implements EmailProvider {
  readonly name = 'brevo';

  constructor(
    private readonly opts: {
      apiKey: string;
      fromAddress: string;
      fromName: string;
      fetchImpl?: typeof fetch;
      timeoutMs?: number;
    },
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const doFetch = this.opts.fetchImpl ?? fetch;
    let res: Response;
    try {
      res = await doFetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.opts.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: this.opts.fromAddress, name: this.opts.fromName },
          to: [{ email: message.to }],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
          tags: [message.tag],
        }),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 10_000),
      });
    } catch (cause) {
      throw new AppError('EMAIL_DELIVERY_FAILED', { cause });
    }
    if (!res.ok) {
      // Só o status vai para o erro; o corpo pode ecoar o destinatário.
      throw new AppError('EMAIL_DELIVERY_FAILED', {
        cause: new Error(`Brevo respondeu HTTP ${res.status}`),
      });
    }
  }
}
