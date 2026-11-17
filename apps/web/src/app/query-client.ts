import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api';
import { meKey } from '../lib/queries';

export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    // Sessão derrubada em qualquer chamada (logout em outro aparelho, shutdown do admin):
    // revalida /me, e o SessionGate leva para o login.
    queryCache: new QueryCache({
      // A própria consulta /me não dispara revalidação de si mesma (evita loop infinito em 401).
      onError: (err, query) => {
        if (query.queryKey[0] !== meKey[0]) onAuthError(err);
      },
    }),
    mutationCache: new MutationCache({ onError: (err) => onAuthError(err) }),
    defaultOptions: { queries: { refetchOnWindowFocus: true } },
  });
  function onAuthError(err: unknown) {
    if (err instanceof ApiError && err.status === 401)
      void client.invalidateQueries({ queryKey: meKey });
  }
  return client;
}
