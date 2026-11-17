import { changePasswordSchema } from '@az/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/PasswordField';
import { ErrorMessage } from '../../components/ui/States';
import { api } from '../../lib/api';
import { meKey } from '../../lib/queries';
import { focusFirstInvalid, validate, type FieldErrors } from '../../lib/validation';

/** Definir (conta sem senha) ou trocar a senha. Trocar derruba as outras sessões. */
export function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const save = useMutation({
    mutationFn: (body: object) => api<void>('/auth/password/change', { body }),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      return qc.invalidateQueries({ queryKey: meKey });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const candidate = {
      currentPassword: hasPassword ? current || undefined : undefined,
      newPassword: next,
    };
    const { data, errors: errs } = validate(changePasswordSchema, candidate);
    if (hasPassword && !current) errs.currentPassword = 'validation.passwordRequired';
    setErrors(errs);
    if (!data || errs.currentPassword) return focusFirstInvalid(formRef.current);
    save.mutate(data);
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <h3 className="font-sans text-base font-semibold">
        {hasPassword ? t('settings.password.titleChange') : t('settings.password.titleSet')}
      </h3>
      <p className="text-[0.95rem] text-ink-muted">
        {hasPassword ? t('settings.password.descChange') : t('settings.password.descSet')}
      </p>
      {save.isSuccess && <Alert tone="success">{t('settings.password.done')}</Alert>}
      {save.error && (
        <Alert tone="danger">
          <ErrorMessage error={save.error} />
        </Alert>
      )}
      {hasPassword && (
        <PasswordField
          label={t('settings.password.current')}
          name="currentPassword"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={errors.currentPassword && t(errors.currentPassword)}
        />
      )}
      <PasswordField
        label={t('settings.password.new')}
        hint={t('auth.register.passwordHint')}
        name="newPassword"
        autoComplete="new-password"
        maxLength={128}
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={errors.newPassword && t(errors.newPassword)}
      />
      <Button type="submit" variant="secondary" className="w-fit" loading={save.isPending}>
        {t('settings.password.submit')}
      </Button>
    </form>
  );
}
