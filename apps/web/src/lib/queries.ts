import type { AccountStatus, Me } from '@az/shared';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from './api';

export const meKey = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: ({ signal }) => api<Me>('/me', { signal }),
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
    staleTime: 30_000,
  });
}

export function homeFor(status: AccountStatus): string {
  return status === 'onboarding_required' ? '/onboarding' : '/';
}
