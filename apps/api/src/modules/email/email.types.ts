export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Categoria para métricas e para o outbox de desenvolvimento. Nunca contém dados pessoais. */
  tag: 'magic_link' | 'verify_email' | 'password_reset';
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}
