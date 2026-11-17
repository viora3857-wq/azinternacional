import { LOCALES, onboardingSchema, type Locale, type Me } from '@az/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { PageTitle } from '../../components/ui/PageTitle';
import { ErrorMessage } from '../../components/ui/States';
import { TextField } from '../../components/ui/TextField';
import { currentLocale, isLocale } from '../../i18n';
import { api } from '../../lib/api';
import { meKey } from '../../lib/queries';
import { focusFirstInvalid, validate, type FieldErrors } from '../../lib/validation';

export function OnboardingPage({ me }: { me: Me }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const localeId = useId();
  const [displayName, setDisplayName] = useState(me.displayName ?? '');
  const [locale, setLocale] = useState<Locale>(currentLocale());
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = useMutation({
    mutationFn: (body: object) => api<void>('/account/onboarding', { body }),
    // O /me atualizado muda o status e o roteador leva para a próxima tela.
    onSuccess: () => qc.invalidateQueries({ queryKey: meKey }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const candidate = {
      displayName,
      locale,
      acceptTerms,
      acceptPrivacy,
    };
    const { data, errors: errs } = validate(onboardingSchema, candidate);
    setErrors(errs);
    if (!data) return focusFirstInvalid(formRef.current);
    submit.mutate(data);
  }

  // Tag <doc> no texto traduzido (não <link>: é elemento HTML vazio e o i18next descartaria o conteúdo).
  const termsLink = (
    <Link
      to="/terms"
      target="_blank"
      rel="noopener"
      className="font-semibold text-primary underline underline-offset-4"
    />
  );
  const privacyLink = (
    <Link
      to="/privacy"
      target="_blank"
      rel="noopener"
      className="font-semibold text-primary underline underline-offset-4"
    />
  );

  return (
    <section>
      <PageTitle text={t('onboarding.title')} subtitle={t('onboarding.subtitle')} />
      <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
        {submit.error && (
          <Alert tone="danger">
            <ErrorMessage error={submit.error} />
          </Alert>
        )}

        <TextField
          label={t('onboarding.nameLabel')}
          hint={t('onboarding.nameHint')}
          name="displayName"
          autoComplete="nickname"
          maxLength={80}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={errors.displayName && t(errors.displayName)}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor={localeId} className="text-sm font-semibold">
            {t('onboarding.languageLabel')}
          </label>
          <select
            id={localeId}
            value={locale}
            onChange={(e) => {
              if (!isLocale(e.target.value)) return;
              setLocale(e.target.value);
              void i18n.changeLanguage(e.target.value);
            }}
            className="min-h-11 rounded-lg border border-line-strong bg-surface px-3 text-base"
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {t(`languages.${l}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-3">
          <Checkbox
            name="acceptTerms"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            error={errors.acceptTerms && t(errors.acceptTerms)}
            label={<Trans i18nKey="onboarding.acceptTerms" components={{ doc: termsLink }} />}
          />
          <Checkbox
            name="acceptPrivacy"
            checked={acceptPrivacy}
            onChange={(e) => setAcceptPrivacy(e.target.checked)}
            error={errors.acceptPrivacy && t(errors.acceptPrivacy)}
            label={<Trans i18nKey="onboarding.acceptPrivacy" components={{ doc: privacyLink }} />}
          />
        </div>

        <Button type="submit" block loading={submit.isPending}>
          {t('onboarding.submit')}
        </Button>
      </form>
    </section>
  );
}
