import { z } from 'zod';
import { emailSchema } from './auth';
import { localeSchema, type Locale } from './locales';
import type { Role } from './roles';

export const ACCOUNT_STATUSES = ['onboarding_required', 'active'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  role: Role;
  locale: Locale;
  status: AccountStatus;
  mfaEnabled: boolean;
  hasPassword: boolean;
  school: { id: string; name: string } | null;
  createdAt: string;
}

export const displayNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  // Letras (qualquer idioma), espaços, hífen, apóstrofo e ponto. Bloqueia markup e caracteres de controle.
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u);

export const onboardingSchema = z.object({
  displayName: displayNameSchema,
  locale: localeSchema,
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const updateProfileSchema = z
  .object({ displayName: displayNameSchema.optional(), locale: localeSchema.optional() })
  .refine((v) => v.displayName !== undefined || v.locale !== undefined, { message: 'empty' });

export const deleteAccountSchema = z.object({ confirmEmail: emailSchema });
