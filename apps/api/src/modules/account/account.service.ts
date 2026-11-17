import { LEGAL_VERSIONS, type Locale, type Me, type OnboardingInput, type Role } from '@az/shared';
import type { AppDeps } from '../../deps';
import { AppError } from '../../lib/errors';
import { accountStatus, type AuthContext } from '../../middleware/auth';
import { audit } from '../audit/audit';
import { isMfaEnabled } from '../auth/mfa.service';

interface MeRow {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
  locale: Locale;
  onboarded_at: Date | null;
  created_at: Date;
  school_id: string | null;
  school_name: string | null;
}

export async function getMe(deps: AppDeps, auth: AuthContext): Promise<Me> {
  // Leitura pelo caminho com RLS: o banco só devolve a linha do próprio usuário.
  const row = await deps.db.asUser(auth.userId, async (c) => {
    const { rows } = await c.query<MeRow>(
      `select u.id, u.email, u.display_name, u.role, u.locale, u.onboarded_at, u.created_at, s.id as school_id, s.name as school_name
         from public.users u left join public.schools s on s.id = u.school_id
        where u.id = $1`,
      [auth.userId],
    );
    return rows[0];
  });
  if (!row) throw new AppError('UNAUTHENTICATED');

  const [mfaEnabled, hasPassword] = await Promise.all([
    isMfaEnabled(deps, auth.userId),
    deps.db.pool
      .query('select 1 from private.user_credentials where user_id = $1', [auth.userId])
      .then((r) => r.rowCount === 1),
  ]);

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    locale: row.locale,
    status: accountStatus(row),
    mfaEnabled,
    hasPassword,
    school: row.school_id && row.school_name ? { id: row.school_id, name: row.school_name } : null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function completeOnboarding(
  deps: AppDeps,
  auth: AuthContext,
  input: OnboardingInput,
  ipHash: string | null,
): Promise<void> {
  await deps.db.system(async (c) => {
    const user = (
      await c.query<{ onboarded_at: Date | null }>(
        'select onboarded_at from public.users where id = $1 for update',
        [auth.userId],
      )
    ).rows[0];
    if (!user) throw new AppError('UNAUTHENTICATED');
    if (user.onboarded_at) throw new AppError('ONBOARDING_ALREADY_DONE');

    await c.query(
      `update public.users set display_name = $2, locale = $3, onboarded_at = now() where id = $1`,
      [auth.userId, input.displayName, input.locale],
    );
    await c.query(
      `insert into public.consents (user_id, kind, document_version, granted, ip_hash)
       values ($1, 'terms', $2, true, $4), ($1, 'privacy', $3, true, $4)`,
      [auth.userId, LEGAL_VERSIONS.terms, LEGAL_VERSIONS.privacy, ipHash],
    );
    await audit(c, {
      actorId: auth.userId,
      action: 'consent.terms_accepted',
      ipHash,
      metadata: { terms: LEGAL_VERSIONS.terms, privacy: LEGAL_VERSIONS.privacy },
    });
  });
}

export async function updateProfile(
  deps: AppDeps,
  auth: AuthContext,
  input: { displayName?: string | undefined; locale?: Locale | undefined },
): Promise<void> {
  // Caminho com RLS + grant por coluna: mesmo com bug aqui, o banco não deixa mudar papel/escola.
  await deps.db.asUser(auth.userId, async (c) => {
    await c.query(
      `update public.users
          set display_name = coalesce($2, display_name), locale = coalesce($3, locale)
        where id = $1`,
      [auth.userId, input.displayName ?? null, input.locale ?? null],
    );
  });
}

/** LGPD art. 18, VI: exclusão. Apaga a conta e tudo ligado a ela (FK on delete cascade). */
export async function deleteAccount(
  deps: AppDeps,
  auth: AuthContext,
  confirmEmail: string,
  ipHash: string | null,
): Promise<void> {
  await deps.db.system(async (c) => {
    const user = (
      await c.query<{ email: string; role: Role }>(
        'select email, role from public.users where id = $1 for update',
        [auth.userId],
      )
    ).rows[0];
    if (!user) throw new AppError('UNAUTHENTICATED');
    if (user.email !== confirmEmail)
      throw new AppError('ACCOUNT_CONFIRMATION_MISMATCH', { fields: ['confirmEmail'] });
    if (user.role === 'owner') {
      const owners = await c.query(
        `select 1 from public.users where role = 'owner' and disabled_at is null`,
      );
      if ((owners.rowCount ?? 0) <= 1) throw new AppError('LAST_OWNER');
    }
    // O evento fica; o vínculo com a pessoa some (actor_id vira null pela FK).
    await audit(c, {
      actorId: auth.userId,
      action: 'account.deleted',
      targetType: 'user',
      targetId: auth.userId,
      ipHash,
    });
    await c.query('delete from private.magic_link_tokens where email = $1', [user.email]);
    await c.query('delete from public.users where id = $1', [auth.userId]);
  });
}
