import type { VerifyResult } from '@az/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/ui/Alert';
import { PageTitle } from '../../components/ui/PageTitle';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { ErrorMessage } from '../../components/ui/States';
import { api } from '../../lib/api';
import { readHashToken } from '../../lib/hash-token';
import { TextLink } from './AuthLinks';
import { useLoginResult } from './useLoginResult';

const KINDS = {
  magic: {
    endpoint: '/auth/magic-link/verify',
    title: 'auth.verify.title',
    invalid: 'auth.verify.invalidTitle',
  },
  email: {
    endpoint: '/auth/verify-email',
    title: 'auth.verifyEmail.title',
    invalid: 'auth.verifyEmail.invalidTitle',
  },
} as const;

/** Troca um token recebido por e-mail (#token=...) por sessão: magic link ou confirmação de e-mail. */
export function TokenLoginPage({ kind }: { kind: keyof typeof KINDS }) {
  const { t } = useTranslation();
  const cfg = KINDS[kind];
  const onResult = useLoginResult();
  const [token] = useState(readHashToken);
  const started = useRef(false);

  const verify = useMutation({
    mutationFn: (tk: string) => api<VerifyResult>(cfg.endpoint, { body: { token: tk } }),
    onSuccess: onResult,
  });

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    // Token de uso único: uma só chamada mesmo com o duplo efeito do StrictMode.
    if (token && !started.current) {
      started.current = true;
      verify.mutate(token);
    }
  }, [token, verify]);

  if (!token || verify.isError) {
    return (
      <section className="flex flex-col gap-5">
        <PageTitle text={t(cfg.invalid)} />
        <Alert tone="danger">
          {verify.error ? <ErrorMessage error={verify.error} /> : t('auth.verify.missingToken')}
        </Alert>
        <TextLink to={kind === 'magic' ? '/login/link' : '/login'}>
          {t('auth.verify.backToLogin')}
        </TextLink>
      </section>
    );
  }

  return (
    <section>
      <h1 className="sr-only">{t(cfg.title)}</h1>
      <PageSkeleton />
    </section>
  );
}
