import type { DbClient } from '../../db/database';
import { generateToken, hashToken } from '../../lib/crypto';

export type EmailTokenPurpose = 'verify_email' | 'password_reset';

export const EMAIL_TOKEN_TTL_MINUTES: Record<EmailTokenPurpose, number> = {
  verify_email: 24 * 60,
  password_reset: 30,
};

/** Cria token de uso único (só o hash vai para o banco). Invalida os anteriores do mesmo tipo. */
export async function createEmailToken(
  c: DbClient,
  userId: string,
  purpose: EmailTokenPurpose,
): Promise<string> {
  await c.query(
    `update private.email_tokens set used_at = now()
      where user_id = $1 and purpose = $2 and used_at is null`,
    [userId, purpose],
  );
  const token = generateToken();
  await c.query(
    `insert into private.email_tokens (user_id, purpose, token_hash, expires_at)
     values ($1, $2, $3, now() + make_interval(mins => $4))`,
    [userId, purpose, hashToken(token), EMAIL_TOKEN_TTL_MINUTES[purpose]],
  );
  return token;
}

/** Consome o token de forma atômica. Devolve o id do usuário, ou null se inválido/expirado/usado. */
export async function consumeEmailToken(
  c: DbClient,
  token: string,
  purpose: EmailTokenPurpose,
): Promise<string | null> {
  const { rows } = await c.query<{ user_id: string }>(
    `update private.email_tokens set used_at = now()
      where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now()
      returning user_id`,
    [hashToken(token), purpose],
  );
  return rows[0]?.user_id ?? null;
}
