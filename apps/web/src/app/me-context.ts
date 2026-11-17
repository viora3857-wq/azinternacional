import type { Me } from '@az/shared';
import { useMe } from '../lib/queries';

/**
 * Usuário logado. Só use abaixo do SessionGate, que garante /me carregado.
 * Lê do cache do React Query: funciona em qualquer nível de layout e reflete atualizações.
 */
export function useMeContext(): Me {
  const { data } = useMe();
  if (!data) throw new Error('useMeContext usado fora do SessionGate');
  return data;
}
