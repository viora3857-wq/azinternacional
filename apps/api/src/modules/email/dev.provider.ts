import type { Logger } from 'pino';
import type { EmailMessage, EmailProvider } from './email.types';

/**
 * SOMENTE DESENVOLVIMENTO E TESTES. Não envia e-mail: guarda em memória e expõe em
 * GET /api/dev/outbox. A configuração recusa este provedor quando NODE_ENV=production.
 */
export class DevOutboxProvider implements EmailProvider {
  readonly name = 'dev';
  private readonly messages: (EmailMessage & { sentAt: string })[] = [];

  constructor(private readonly logger?: Logger) {}

  async send(message: EmailMessage): Promise<void> {
    this.messages.push({ ...message, sentAt: new Date().toISOString() });
    if (this.messages.length > 100) this.messages.shift();
    this.logger?.info(
      { tag: message.tag },
      'E-mail de desenvolvimento guardado em /api/dev/outbox',
    );
  }

  list(to?: string) {
    return this.messages
      .filter((m) => !to || m.to === to)
      .slice()
      .reverse();
  }

  clear() {
    this.messages.length = 0;
  }
}
