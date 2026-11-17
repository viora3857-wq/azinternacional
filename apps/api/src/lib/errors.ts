import type { ErrorCode } from '@az/shared';
import type { ZodType } from 'zod';

const STATUS: Partial<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  CSRF_REJECTED: 403,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  EMAIL_DELIVERY_FAILED: 502,
  INTERNAL: 500,
  ONBOARDING_REQUIRED: 403,
  INVALID_CREDENTIALS: 401,
  EMAIL_NOT_VERIFIED: 403,
};

export class AppError extends Error {
  readonly status: number;
  readonly fields: string[] | undefined;

  constructor(
    readonly code: ErrorCode,
    options: { status?: number; fields?: string[]; cause?: unknown } = {},
  ) {
    super(code, { cause: options.cause });
    this.status = options.status ?? STATUS[code] ?? 400;
    this.fields = options.fields;
  }
}

/** Valida e devolve o valor tipado. Em erro, informa só os caminhos dos campos, nunca os valores. */
export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((i) => i.path.join('.') || '(root)'))];
    throw new AppError('VALIDATION_FAILED', { fields });
  }
  return result.data;
}
