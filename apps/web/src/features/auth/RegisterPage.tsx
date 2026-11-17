import { registerSchema } from '@az/shared';
import { useMutation } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageTitle } from '../../components/ui/PageTitle';
import { PasswordField } from '../../components/ui/PasswordField';
import { ErrorMessage } from '../../components/ui/States';
import { TextField } from '../../components/ui/TextField';
import { currentLocale } from '../../i18n';
import { api } from '../../lib/api';
import { focusFirstInvalid, validate, type FieldErrors } from '../../lib/validation';
import { linkClass, TextLink } from './AuthLinks';

export function RegisterPage() {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: (body: object) => api<void>('/auth/register', { body }),
    onSuccess: () =>
      setSentTo(registerSchema.parse({ email, password, locale: currentLocale() }).email),
  });
  const resend = useMutation({
    mutationFn: (to: string) =>
      api<void>('/auth/verify-email/resend', { body: { email: to, locale: currentLocale() } }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const { data, errors: errs } = validate(registerSchema, {
      email,
      password,
      locale: currentLocale(),
    });
    setErrors(errs);
    if (!data) return focusFirstInvalid(formRef.current);
    register.mutate(data);
  }

  if (sentTo) {
    return (
      <section className="flex flex-col gap-5">
        <span className="w-fit rounded-full bg-success-soft p-3 text-success" aria-hidden="true">
          <MailCheck className="size-7" />
        </span>
        <PageTitle
          text={t('auth.register.sentTitle')}
          subtitle={t('auth.register.sentBody', { email: sentTo })}
        />
        <p className="text-[0.95rem] text-ink-muted">{t('auth.register.sentHint')}</p>
        {resend.isSuccess && <Alert tone="success">{t('auth.login.resent')}</Alert>}
        {resend.error && (
          <Alert tone="danger">
            <ErrorMessage error={resend.error} />
          </Alert>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="secondary"
            loading={resend.isPending}
            onClick={() => resend.mutate(sentTo)}
          >
            {t('auth.register.resend')}
          </Button>
          <TextLink to="/login">{t('auth.register.login')}</TextLink>
        </div>
      </section>
    );
  }

  return (
    <section>
      <PageTitle text={t('auth.register.title')} subtitle={t('auth.register.subtitle')} />
      <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {register.error && (
          <Alert tone="danger">
            <ErrorMessage error={register.error} />
          </Alert>
        )}
        <TextField
          label={t('auth.login.emailLabel')}
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email && t(errors.email)}
        />
        <PasswordField
          label={t('auth.login.passwordLabel')}
          hint={t('auth.register.passwordHint')}
          name="password"
          autoComplete="new-password"
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password && t(errors.password)}
        />
        <Button type="submit" block loading={register.isPending}>
          {t('auth.register.submit')}
        </Button>
      </form>
      <p className="mt-6 text-[0.95rem]">
        {t('auth.register.haveAccount')} <TextLink to="/login">{t('auth.register.login')}</TextLink>
      </p>
      <p className="mt-4 text-sm text-ink-muted">
        <Trans
          i18nKey="auth.login.legal"
          components={{
            terms: <Link to="/terms" className={linkClass} />,
            privacy: <Link to="/privacy" className={linkClass} />,
          }}
        />
      </p>
    </section>
  );
}
