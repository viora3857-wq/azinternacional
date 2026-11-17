import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * scrypt (memory-hard), nativo do Node. N=2^15, r=8, p=1 ≈ 32 MiB e ~60–100 ms por hash:
 * caro para força bruta offline, aceitável numa instância pequena do Render.
 */
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 32;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // NFKC: a mesma senha digitada em teclados diferentes gera o mesmo hash.
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEYLEN,
      { N: n, r, p, maxmem: 256 * n * r },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await derive(
    password,
    Buffer.from(salt, 'base64url'),
    Number(n),
    Number(r),
    Number(p),
  );
  return key.length === expected.length && timingSafeEqual(key, expected);
}

let dummy: Promise<string> | undefined;
/** Hash descartável: comparar contra ele quando o usuário não existe iguala o tempo de resposta. */
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(16).toString('hex'));
  return dummy;
}
