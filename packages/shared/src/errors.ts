/**
 * Códigos de erro estáveis devolvidos pela API. O front traduz cada código
 * (chave `errors.<CODE>` nos arquivos de tradução); a API nunca devolve texto de interface.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'CSRF_REJECTED',
  'PAYLOAD_TOO_LARGE',
  'MAGIC_LINK_INVALID',
  'MFA_INVALID_CODE',
  'MFA_CHALLENGE_INVALID',
  'MFA_ALREADY_ENABLED',
  'MFA_NOT_ENABLED',
  'MFA_SETUP_NOT_STARTED',
  'ONBOARDING_REQUIRED',
  'ONBOARDING_ALREADY_DONE',
  'ACCOUNT_CONFIRMATION_MISMATCH',
  'INVALID_CREDENTIALS',
  'EMAIL_NOT_VERIFIED',
  'EMAIL_TOKEN_INVALID',
  'CURRENT_PASSWORD_INVALID',
  'LAST_OWNER',
  'EMAIL_DELIVERY_FAILED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    /** Identificador da requisição, para suporte e correlação de logs. */
    requestId?: string;
    /** Campos inválidos (apenas para VALIDATION_FAILED). Nunca contém o valor enviado. */
    fields?: string[];
  };
}
