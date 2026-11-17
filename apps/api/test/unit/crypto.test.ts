import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, generateToken, hashToken, pseudonymize } from '../../src/lib/crypto';

describe('tokens', () => {
  it('gera 43 caracteres base64url e nunca repete', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateToken));
    expect(tokens.size).toBe(1000);
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it('hash é determinístico e diferente do token', () => {
    const t = generateToken();
    expect(hashToken(t).equals(hashToken(t))).toBe(true);
    expect(hashToken(t).toString('base64url')).not.toBe(t);
  });
});

describe('pseudonymize', () => {
  it('não devolve o valor original e depende do pepper', () => {
    const a = pseudonymize('203.0.113.7', 'p'.repeat(32));
    expect(a).not.toContain('203');
    expect(a).toBe(pseudonymize('203.0.113.7', 'p'.repeat(32)));
    expect(a).not.toBe(pseudonymize('203.0.113.7', 'q'.repeat(32)));
  });
});

describe('encrypt/decrypt (AES-256-GCM)', () => {
  const key = randomBytes(32);
  it('faz ida e volta', () => {
    expect(decrypt(encrypt('JBSWY3DPEHPK3PXP', key), key)).toBe('JBSWY3DPEHPK3PXP');
  });
  it('usa IV aleatório (mesma entrada, saídas diferentes)', () => {
    expect(encrypt('x', key)).not.toBe(encrypt('x', key));
  });
  it('detecta adulteração', () => {
    const parts = encrypt('segredo', key).split('.');
    const ct = Buffer.from(parts[3]!, 'base64url');
    ct[0] = ct[0]! ^ 1;
    parts[3] = ct.toString('base64url');
    expect(() => decrypt(parts.join('.'), key)).toThrow();
  });
  it('falha com chave errada', () => {
    expect(() => decrypt(encrypt('segredo', key), randomBytes(32))).toThrow();
  });
});
