import { mfaVerifySchema, opaqueTokenSchema, type VerifyResult } from '@az/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageTitle } from '../../components/ui/PageTitle';
import { ErrorMessage } from '../../components/ui/States';
import { TextField } from '../../components/ui/TextField';
import { api, isApiError } from '../../lib/api';
import { meKey } from '../../lib/queries';
import { focusFirstInvalid, validate, type FieldErrors } from '../../lib/validation';

export function MfaPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const location = useLocation();
  const formRef = useRef<HTMLFormElement>(null);
  const state: unknown = location.state;
  const challengeRaw =
    typeof state === 'object' && state !== null
      ? (state as { challenge?: unknown }).challenge
      : null;
  const challenge = opaqueTokenSchema.safeParse(challengeRaw).success
    ? (challengeRaw as string)
    : null;
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const verify = useMutation({
    mutationFn: (body: { challenge: string; code: string }) =>
      api<VerifyResult>('/auth/mfa/verify', { body }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: meKey });
      navigate('/', { replace: true });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const { data, errors: errs } = validate(mfaVerifySchema, { challenge, code: code.trim() });
    setErrors(errs);
    if (!data) return focusFirstInvalid(formRef.current);
    verify.mutate(data);
  }

  if (!challenge) {
    return (
      <section className="flex flex-col gap-5">
        <PageTitle text={t('auth.mfa.title')} />
        <Alert tone="warning">{t('auth.mfa.missing')}</Alert>
        <Link to="/login" className="w-fit font-semibold text-primary underline underline-offset-4">
          {t('auth.verify.backToLogin')}
        </Link>
      </section>
    );
  }

  const dead = isApiError(verify.error, 'MFA_CHALLENGE_INVALID');

  return (
    <section>
      <PageTitle text={t('auth.mfa.title')} subtitle={t('auth.mfa.subtitle')} />
      <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {verify.error && (
          <Alert tone="danger">
            <ErrorMessage error={verify.error} />
            {dead && (
              <Link to="/login" className="font-semibold text-primary underline underline-offset-4">
                {t('auth.verify.backToLogin')}
              </Link>
            )}
          </Alert>
        )}
        <TextField
          label={t('auth.mfa.codeLabel')}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          error={errors.code && t(errors.code)}
          className="max-w-48"
        />
        <Button type="submit" block loading={verify.isPending} disabled={dead}>
          {t('auth.mfa.submit')}
        </Button>
      </form>
    </section>
  );
}
