import type { AuthContext } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      /** IP pseudonimizado (HMAC). O IP em claro nunca é gravado. */
      ipHash: string | null;
      auth?: AuthContext;
    }
  }
}

export {};
