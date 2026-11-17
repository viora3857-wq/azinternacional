import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/config/env';

const valid = {
  APP_URL: 'http://localhost:5173',
  DATABASE_URL: 'postgres://u:p@localhost/db',
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  HASH_PEPPER: 'x'.repeat(32),
  EMAIL_PROVIDER: 'dev',
  EMAIL_FROM_ADDRESS: 'no-reply@az.example',
};

describe('loadConfig', () => {
  it('carrega configuração válida com padrões', () => {
    const c = loadConfig(valid);
    expect(c.PORT).toBe(3000);
    expect(c.appOrigin).toBe('http://localhost:5173');
    expect(c.sessionCookieName).toBe('az_session');
    expect(c.encryptionKey).toHaveLength(32);
  });

  it('trata variável vazia (CHAVE=) como não definida', () => {
    const c = loadConfig({ ...valid, BREVO_API_KEY: '', PORT: '', LOG_LEVEL: '' });
    expect(c.BREVO_API_KEY).toBeUndefined();
    expect(c.PORT).toBe(3000);
    expect(() => loadConfig({ ...valid, HASH_PEPPER: '' })).toThrow(/HASH_PEPPER/);
  });

  it('recusa chave de criptografia com tamanho errado', () => {
    expect(() => loadConfig({ ...valid, DATA_ENCRYPTION_KEY: 'abc' })).toThrow(ConfigError);
  });

  it('exige BREVO_API_KEY com provedor brevo', () => {
    expect(() => loadConfig({ ...valid, EMAIL_PROVIDER: 'brevo' })).toThrow(/BREVO_API_KEY/);
  });

  it('em produção recusa e-mail dev, http e banco sem TLS', () => {
    const prod = { ...valid, NODE_ENV: 'production' };
    expect(() => loadConfig(prod)).toThrow(/EMAIL_PROVIDER/);
    expect(() => loadConfig(prod)).toThrow(/APP_URL/);
    expect(() => loadConfig(prod)).toThrow(/DATABASE_SSL/);
  });

  it('em produção usa cookie __Host-', () => {
    const c = loadConfig({
      ...valid,
      NODE_ENV: 'production',
      EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'k',
      APP_URL: 'https://app.az.example',
      DATABASE_SSL: 'require',
    });
    expect(c.sessionCookieName).toBe('__Host-az_session');
  });

  it('não vaza valores na mensagem de erro', () => {
    try {
      loadConfig({ ...valid, HASH_PEPPER: 'curto-e-secreto' });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).toContain('HASH_PEPPER');
      expect(String(e)).not.toContain('curto-e-secreto');
    }
  });
});
