import { describe, expect, it } from 'vitest';
import { dummyHash, hashPassword, verifyPassword } from '../../src/lib/password';

describe('hash de senha (scrypt)', () => {
  it('não guarda a senha e usa sal aleatório', async () => {
    const a = await hashPassword('minha senha secreta');
    const b = await hashPassword('minha senha secreta');
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$[\w-]{22}\$[\w-]{43}$/);
    expect(a).not.toContain('minha');
    expect(a).not.toBe(b);
  });

  it('confere a senha certa e recusa a errada', async () => {
    const h = await hashPassword('correta-123456');
    expect(await verifyPassword('correta-123456', h)).toBe(true);
    expect(await verifyPassword('Correta-123456', h)).toBe(false);
    expect(await verifyPassword('', h)).toBe(false);
  });

  it('normaliza Unicode (NFKC): mesma senha com acento composto ou decomposto', async () => {
    const h = await hashPassword('café-seguro-1');
    expect(await verifyPassword('café-seguro-1', h)).toBe(true);
  });

  it('recusa hash adulterado ou em formato desconhecido', async () => {
    const h = await hashPassword('correta-123456');
    const parts = h.split('$');
    parts[5] = 'A'.repeat(43);
    expect(await verifyPassword('correta-123456', parts.join('$'))).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$2b$10$abc')).toBe(false);
  });

  it('hash descartável existe e não confere com nada previsível', async () => {
    expect(await verifyPassword('', await dummyHash())).toBe(false);
  });
});
