import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

/** Token opaco de 256 bits em base64url (43 caracteres). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Tokens têm 256 bits de entropia, então SHA-256 basta (não precisa de hash lento).
 * O banco guarda só o hash: um vazamento do banco não permite usar links ou sessões.
 */
export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

/** Pseudonimiza um valor (ex.: IP) com HMAC + pepper. Permite correlacionar sem guardar o dado. */
export function pseudonymize(value: string, pepper: string): string {
  return createHmac('sha256', pepper).update(value, 'utf8').digest('base64url').slice(0, 22);
}

const VERSION = 'v1';

/** AES-256-GCM. Formato: v1.<iv>.<tag>.<ciphertext>, tudo base64url. */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ct.toString('base64url'),
  ].join('.');
}

export function decrypt(payload: string, key: Buffer): string {
  const [version, iv, tag, ct] = payload.split('.');
  if (version !== VERSION || !iv || !tag || ct === undefined) {
    throw new Error('Formato de dado cifrado inválido');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString(
    'utf8',
  );
}
