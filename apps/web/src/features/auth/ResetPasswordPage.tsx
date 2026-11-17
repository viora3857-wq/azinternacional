import { resetPasswordSchema } from '@az/shared';
import { useMutation } from '@tanstack/react-query';
import { CircleCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageTitle } from '../../components/ui/PageTitle';
import { PasswordField } from '../../components/ui/PasswordField';
import { ErrorMessage } from '../../components/ui/States';
import { api, isApiError } from '../../lib/api';
import { readHashToken } from '../../lib/hash-token';
import { focusFirstInvalid, validate, type FieldErrors } from '../../lib/validation';
import { TextLink } from './AuthLinks';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [token] = useState(readHashToken);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const reset = useMutation({
    mutationFn: (body: { token: string; password: string }) =>
      api<void>('/auth/password/reset', { body }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const { data, errors: errs } = validate(resetPasswordSchema, { token, password });
    setErrors(errs);
    if (!data) return focusFirstInvalid(formRef.current);
    reset.mutate(data);
  }

  if (!token || isApiError(reset.error, 'EMAIL_TOKEN_INVALID')) {
    return (
      <section className="flex flex-col gap-5">
        <PageTitle text={t('auth.reset.invalidTitle')} />
        <Alert tone="danger">{t('errors.EMAIL_TOKEN_INVALID')}</Alert>
        <TextLink to="/forgot-password">{t('auth.reset.newLink')}</TextLink>
      </section>
    );
  }

  if (reset.isSuccess) {
    return (
      <section className="flex flex-col gap-5">
        <span className="w-fit rounded-full bg-success-soft p-3 text-success" aria-hidden="true">
          <CircleCheck className="size-7" />
        </span>
        <PageTitle text={t('auth.reset.doneTitle')} subtitle={t('auth.reset.doneBody')} />
        <TextLink to="/login">{t('auth.reset.login')}</TextLink>
      </section>
    );
  }

  return (
    <section>
      <PageTitle text={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')} />
      <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {reset.error && (
          <Alert tone="danger">
            <ErrorMessage error={reset.error} />
          </Alert>
        )}
        <PasswordField
          label={t('auth.reset.passwordLabel')}
          hint={t('auth.register.passwordHint')}
          name="password"
          autoComplete="new-password"
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password && t(errors.password)}
        />
        <Button type="submit" block loading={reset.isPending}>
          {t('auth.reset.submit')}
        </Button>
      </form>
    </section>
  );
}
