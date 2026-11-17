import { ERROR_CODES, type ErrorCode } from '@az/shared';
import { z } from 'zod';

/** Códigos do servidor + falhas que só o cliente enxerga. */
export type ClientErrorCode = ErrorCode | 'NETWORK' | 'UNKNOWN';

export class ApiError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    readonly status: number,
    readonly fields: string[] = [],
    readonly requestId?: string,
  ) {
    super(code);
  }
}

const errorBodySchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    requestId: z.string().optional(),
    fields: z.array(z.string()).optional(),
  }),
});

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Único ponto de saída para a API. Sempre mesma origem (/api), cookie de sessão HttpOnly.
 * Nunca há chave de API no navegador.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
      headers:
        opts.body === undefined
          ? { accept: 'application/json' }
          : { 'content-type': 'application/json', accept: 'application/json' },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: 'same-origin',
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError('NETWORK', 0);
  }

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    const parsed = errorBodySchema.safeParse(data);
    if (parsed.success) {
      const { code, fields, requestId } = parsed.data.error;
      throw new ApiError(code, res.status, fields ?? [], requestId);
    }
    throw new ApiError('UNKNOWN', res.status);
  }
  return data as T;
}

export function isApiError(err: unknown, code?: ClientErrorCode): err is ApiError {
  return err instanceof ApiError && (code === undefined || err.code === code);
}
