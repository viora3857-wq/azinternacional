import { z } from 'zod';
import { localeSchema } from './locales';

/** E-mail normalizado: sem espaços, minúsculo, tamanho máximo do RFC 5321. */
export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const magicLinkRequestSchema = z.object({
  email: emailSchema,
  locale: localeSchema.default('pt'),
});
export type MagicLinkRequest = z.infer<typeof magicLinkRequestSchema>;

/** Tokens opacos gerados pelo servidor: 32 bytes em base64url = 43 caracteres. */
export const opaqueTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const magicLinkVerifySchema = z.object({ token: opaqueTokenSchema });

export const totpCodeSchema = z.string().regex(/^\d{6}$/);

export const mfaVerifySchema = z.object({
  challenge: opaqueTokenSchema,
  code: totpCodeSchema,
});

export const mfaCodeSchema = z.object({ code: totpCodeSchema });

export type VerifyResult =
  { status: 'authenticated' } | { status: 'mfa_required'; challenge: string };

export interface MfaSetupResponse {
  /** URI otpauth:// para gerar o QR code no app autenticador. */
  otpauthUri: string;
  /** Segredo em base32, para digitação manual. */
  secret: string;
}

/**
 * Senha: comprimento importa mais que regras de composição (NIST SP 800-63B).
 * 10 a 128 caracteres; o limite superior evita hash caro de entradas gigantes.
 */
export const passwordSchema = z.string().min(10).max(128);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  locale: localeSchema.default('pt'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const emailRequestSchema = z.object({
  email: emailSchema,
  locale: localeSchema.default('pt'),
});

export const emailTokenSchema = z.object({ token: opaqueTokenSchema });

export const resetPasswordSchema = z.object({ token: opaqueTokenSchema, password: passwordSchema });

export const changePasswordSchema = z.object({
  /** Obrigatória quando a conta já tem senha. */
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: passwordSchema,
});
