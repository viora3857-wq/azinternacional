import type { ParseKeys } from 'i18next';
import type { ZodType } from 'zod';

const FIELD_MESSAGES: Record<string, ParseKeys> = {
  email: 'validation.email',
  displayName: 'validation.displayName',
  confirmEmail: 'validation.email',
  code: 'validation.code',
  acceptTerms: 'validation.accept',
  acceptPrivacy: 'validation.accept',
  password: 'validation.password',
  newPassword: 'validation.password',
  currentPassword: 'validation.passwordRequired',
};

export type FieldErrors = Partial<Record<string, ParseKeys>>;

/** Valida com o mesmo schema Zod do servidor e devolve chaves de tradução por campo. */
export function validate<T>(
  schema: ZodType<T>,
  value: unknown,
  overrides: FieldErrors = {},
): { data?: T; errors: FieldErrors } {
  const r = schema.safeParse(value);
  if (r.success) return { data: r.data, errors: {} };
  const errors: FieldErrors = {};
  for (const issue of r.error.issues) {
    const field = String(issue.path[0] ?? '');
    errors[field] ??= overrides[field] ?? FIELD_MESSAGES[field] ?? 'errors.VALIDATION_FAILED';
  }
  return { errors };
}

/** Move o foco para o primeiro campo inválido (teclado e leitor de tela). */
export function focusFirstInvalid(form: HTMLFormElement | null): void {
  requestAnimationFrame(() =>
    form?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"] input')?.focus(),
  );
}
