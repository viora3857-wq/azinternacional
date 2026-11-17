import type { Locale } from '@az/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from './api';
import { meKey } from './queries';

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST', body: {} }),
    onSettled: () => {
      qc.clear();
      navigate('/login', { replace: true });
    },
  });
}

export function usePersistLocale() {
  const qc = useQueryClient();
  return (locale: Locale) => {
    void api<void>('/account/profile', { method: 'PATCH', body: { locale } })
      .then(() => qc.invalidateQueries({ queryKey: meKey }))
      .catch(() => undefined); // o idioma já mudou na tela; falha só não sincroniza com a conta
  };
}
