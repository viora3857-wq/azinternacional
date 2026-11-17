import type { VerifyResult } from '@az/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { meKey } from '../../lib/queries';

/** Destino comum a todo login: tela do código 2FA ou área logada. */
export function useLoginResult() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async (result: VerifyResult) => {
    if (result.status === 'mfa_required') {
      navigate('/login/mfa', { replace: true, state: { challenge: result.challenge } });
      return;
    }
    await qc.invalidateQueries({ queryKey: meKey });
    navigate('/', { replace: true });
  };
}
