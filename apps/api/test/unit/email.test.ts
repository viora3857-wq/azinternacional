import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/lib/errors';
import { BrevoProvider } from '../../src/modules/email/brevo.provider';
import {
  escapeHtml,
  layoutForTest,
  passwordResetEmail,
  verifyEmailEmail,
  magicLinkEmail,
} from '../../src/modules/email/templates';

describe('templates', () => {
  it('escapa HTML nos dados interpolados', () => {
    const html = layoutForTest(
      ['<img src=x onerror=alert(1)>'],
      { label: 'ok', href: 'https://x/"><script>' },
      'f',
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('"><script>');
    expect(html).toContain('&lt;img');
  });

  it('confirmação e redefinição trazem o link e o aviso de prazo', () => {
    const v = verifyEmailEmail('a@escola.example', 'pt', 'https://app/verify-email#token=T');
    expect(v.text).toContain('https://app/verify-email#token=T');
    expect(v.text).toContain('24 horas');
    const r = passwordResetEmail('a@escola.example', 'en', 'https://app/reset-password#token=T');
    expect(r.text).toContain('30 minutes');
    expect(r.tag).toBe('password_reset');
  });

  it('gera e-mail de login nos três idiomas com o link', () => {
    for (const locale of ['pt', 'en', 'es'] as const) {
      const msg = magicLinkEmail('a@escola.example', locale, 'https://app/login/verify#token=T');
      expect(msg.text).toContain('https://app/login/verify#token=T');
      expect(msg.subject.length).toBeGreaterThan(5);
    }
  });

  it('escapeHtml cobre aspas', () => {
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });
});

describe('BrevoProvider', () => {
  const msg = magicLinkEmail('a@escola.example', 'pt', 'https://app/x');
  const opts = { apiKey: 'k', fromAddress: 'no-reply@az.example', fromName: 'AZ' };

  it('envia para a API v3 com a chave no cabeçalho', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    await new BrevoProvider({ ...opts, fetchImpl }).send(msg);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('k');
    expect(JSON.parse(init.body).to).toEqual([{ email: 'a@escola.example' }]);
  });

  it('transforma HTTP de erro em EMAIL_DELIVERY_FAILED', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    await expect(new BrevoProvider({ ...opts, fetchImpl }).send(msg)).rejects.toMatchObject({
      code: 'EMAIL_DELIVERY_FAILED',
    });
  });

  it('transforma falha de rede em EMAIL_DELIVERY_FAILED', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(new BrevoProvider({ ...opts, fetchImpl }).send(msg)).rejects.toBeInstanceOf(
      AppError,
    );
  });
});
