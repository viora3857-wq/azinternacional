import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUri,
  timeStep,
  totp,
  verifyTotp,
} from '../../src/lib/totp';

// Vetores oficiais do RFC 6238 (SHA-1), truncados para 6 dígitos.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'));
const VECTORS: [number, string][] = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
];

describe('TOTP RFC 6238', () => {
  it.each(VECTORS)('t=%i -> %s', (seconds, expected) => {
    expect(totp(RFC_SECRET, seconds * 1000)).toBe(expected);
  });

  it('base32 faz ida e volta', () => {
    const buf = Buffer.from('qualquer coisa 123', 'utf8');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it('segredo gerado tem 160 bits', () => {
    expect(base32Decode(generateTotpSecret())).toHaveLength(20);
  });
});

describe('verifyTotp', () => {
  const secret = generateTotpSecret();
  const now = 1_800_000_000_000;

  it('aceita o código atual e ±1 passo', () => {
    expect(verifyTotp(secret, totp(secret, now), now)).toBe(timeStep(now));
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).toBe(timeStep(now) - 1);
    expect(verifyTotp(secret, totp(secret, now + 30_000), now)).toBe(timeStep(now) + 1);
  });

  it('rejeita código de 2 passos atrás', () => {
    expect(verifyTotp(secret, totp(secret, now - 60_000), now)).toBeNull();
  });

  it('rejeita reuso (passo já consumido)', () => {
    const code = totp(secret, now);
    expect(verifyTotp(secret, code, now, timeStep(now))).toBeNull();
  });

  it('rejeita formato inválido', () => {
    expect(verifyTotp(secret, '12345', now)).toBeNull();
    expect(verifyTotp(secret, 'abcdef', now)).toBeNull();
  });

  it('gera URI otpauth com emissor e conta', () => {
    const uri = otpauthUri('AZ Internacional', 'a@escola.example', 'ABC');
    expect(uri).toMatch(/^otpauth:\/\/totp\/AZ%20Internacional%3Aa%40escola\.example\?/);
    expect(uri).toContain('secret=ABC');
  });
});
