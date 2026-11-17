import { emailRequestSchema } from '@az/shared';
import { useMutation } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageTitle } from '../../components/ui/PageTitle';
import { ErrorMessage } from '../../components/ui/States';
import { TextField } from '../../components/ui/TextField';
import { currentLocale } from '../../i18n';
import { api } from '../../lib/api';
import { focusFirstInvalid, validate, type FieldErrors } from '../../lib/validation';
import { TextLink } from './AuthLinks';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  const request = useMutation({
    mutationFn: (body: { email: string; locale: string }) =>
      api<void>('/auth/password/forgot', { body }),
    onSuccess: (_d, vars) => setSentTo(vars.email),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const { data, errors: errs } = validate(emailRequestSchema, { email, locale: currentLocale() });
    setErrors(errs);
    if (!data) return focusFirstInvalid(formRef.current);
    request.mutate(data);
  }

  if (sentTo) {
    return (
      <section className="flex flex-col gap-5">
        <span className="w-fit rounded-full bg-success-soft p-3 text-success" aria-hidden="true">
          <MailCheck className="size-7" />
        </span>
        <PageTitle
          text={t('auth.forgot.sentTitle')}
          subtitle={t('auth.forgot.sentBody', { email: sentTo })}
        />
        <TextLink to="/login">{t('auth.forgot.back')}</TextLink>
      </section>
    );
  }

  return (
    <section>
      <PageTitle text={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')} />
      <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {request.error && (
          <Alert tone="danger">
            <ErrorMessage error={request.error} />
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
        <Button type="submit" block loading={request.isPending}>
          {t('auth.forgot.submit')}
        </Button>
        <TextLink to="/login">{t('auth.forgot.back')}</TextLink>
      </form>
    </section>
  );
}
