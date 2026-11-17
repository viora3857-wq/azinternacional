import { emailSchema, loginSchema, type VerifyResult } from '@az/shared';
import { useMutation } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageTitle } from '../../components/ui/PageTitle';
import { PasswordField } from '../../components/ui/PasswordField';
import { ErrorMessage } from '../../components/ui/States';
import { TextField } from '../../components/ui/TextField';
import { currentLocale } from '../../i18n';
import { api, isApiError } from '../../lib/api';
import { focusFirstInvalid, validate, type FieldErrors } from '../../lib/validation';
import { linkClass, TextLink } from './AuthLinks';
import { useLoginResult } from './useLoginResult';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const onResult = useLoginResult();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const login = useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<VerifyResult>('/auth/login', { body }),
    onSuccess: onResult,
  });
  const resend = useMutation({
    mutationFn: (to: string) =>
      api<void>('/auth/verify-email/resend', { body: { email: to, locale: currentLocale() } }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const { data, errors: errs } = validate(
      loginSchema,
      { email, password },
      { password: 'validation.passwordRequired' },
    );
    setErrors(errs);
    if (!data) return focusFirstInvalid(formRef.current);
    resend.reset();
    login.mutate(data);
  }

  const notVerified = isApiError(login.error, 'EMAIL_NOT_VERIFIED');

  return (
    <section>
      <PageTitle text={t('auth.login.title')} subtitle={t('auth.login.subtitle')} />
      <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {login.error && (
          <Alert tone={notVerified ? 'warning' : 'danger'}>
            <ErrorMessage error={login.error} />
            {notVerified && !resend.isSuccess && (
              <Button
                variant="secondary"
                className="mt-2 w-fit"
                loading={resend.isPending}
                onClick={() =>
                  emailSchema.safeParse(email).success && resend.mutate(emailSchema.parse(email))
                }
              >
                {t('auth.login.resend')}
              </Button>
            )}
            {resend.isSuccess && <span>{t('auth.login.resent')}</span>}
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
        <div className="flex flex-col gap-2">
          <PasswordField
            label={t('auth.login.passwordLabel')}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password && t(errors.password)}
          />
          <Link to="/forgot-password" className={`w-fit text-sm ${linkClass}`}>
            {t('auth.login.forgot')}
          </Link>
        </div>
        <Button type="submit" block loading={login.isPending}>
          {t('auth.login.submit')}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-sm text-ink-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {t('auth.login.or')}
        <span className="h-px flex-1 bg-line" />
      </div>
      <Button
        variant="secondary"
        block
        icon={<Mail className="size-4" aria-hidden />}
        onClick={() => navigate('/login/link')}
      >
        {t('auth.login.magicLink')}
      </Button>

      <p className="mt-6 text-[0.95rem]">
        {t('auth.login.noAccount')} <TextLink to="/register">{t('auth.login.register')}</TextLink>
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
