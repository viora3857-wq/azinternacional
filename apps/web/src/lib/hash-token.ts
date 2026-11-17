import { opaqueTokenSchema } from '@az/shared';

/** Lê o token do fragmento (#token=...) e o remove da barra de endereço e do histórico. */
export function readHashToken(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('token');
  return opaqueTokenSchema.safeParse(token).success ? token : null;
}
