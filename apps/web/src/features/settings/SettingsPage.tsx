import { displayNameSchema } from '@az/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMeContext } from '../../app/me-context';
import { usePersistLocale } from '../../lib/session-hooks';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageTitle } from '../../components/ui/PageTitle';
import { ErrorMessage } from '../../components/ui/States';
import { TextField } from '../../components/ui/TextField';
import { api } from '../../lib/api';
import { meKey } from '../../lib/queries';
import { focusFirstInvalid } from '../../lib/validation';
import { DeleteAccountSection } from './DeleteAccountSection';
import { MfaSection } from './MfaSection';
import { PasswordSection } from './PasswordSection';

export function SettingsPage() {
  const { t } = useTranslation();
  const me = useMeContext();
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#security') document.getElementById('security')?.scrollIntoView();
  }, [location.hash]);

  return (
    <>
      <PageTitle text={t('settings.title')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard />
        <Card title={t('settings.appearance.title')}>
          <div className="flex flex-col gap-5">
            <ThemeSwitcher showLegend />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">{t('common.language')}</span>
              <LanguageSwitcher onPersist={usePersistLocale()} />
            </div>
          </div>
        </Card>
        <Card id="security" title={t('settings.security.title')} className="scroll-mt-24">
          <div className="flex flex-col gap-6">
            <PasswordSection hasPassword={me.hasPassword} />
            <div className="border-t border-line pt-5">
              <MfaSection enabled={me.mfaEnabled} />
            </div>
            <LogoutAll />
          </div>
        </Card>
        <Card title={t('settings.privacy.title')}>
          <DeleteAccountSection email={me.email} bare />
        </Card>
      </div>
    </>
  );
}

function ProfileCard() {
  const { t } = useTranslation();
  const me = useMeContext();
  const qc = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(me.displayName ?? '');
  const [invalid, setInvalid] = useState(false);

  const save = useMutation({
    mutationFn: (displayName: string) =>
      api<void>('/account/profile', { method: 'PATCH', body: { displayName } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: meKey }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = displayNameSchema.safeParse(name);
    setInvalid(!r.success);
    if (!r.success) return focusFirstInvalid(formRef.current);
    save.mutate(r.data);
  }

  return (
    <Card title={t('settings.profile.title')}>
      <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.95rem]">
        <dt className="text-ink-muted">{t('settings.profile.email')}</dt>
        <dd className="break-all">{me.email}</dd>
        {me.school && (
          <>
            <dt className="text-ink-muted">{t('settings.profile.school')}</dt>
            <dd>{me.school.name}</dd>
          </>
        )}
        <dt className="text-ink-muted">{t('settings.profile.role')}</dt>
        <dd>{t(`settings.roles.${me.role}`)}</dd>
      </dl>
      <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {save.isSuccess && <Alert tone="success">{t('common.saved')}</Alert>}
        {save.error && (
          <Alert tone="danger">
            <ErrorMessage error={save.error} />
          </Alert>
        )}
        <TextField
          label={t('onboarding.nameLabel')}
          name="displayName"
          maxLength={80}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            save.reset();
          }}
          error={invalid ? t('validation.displayName') : undefined}
        />
        <Button type="submit" variant="secondary" className="w-fit" loading={save.isPending}>
          {t('common.save')}
        </Button>
      </form>
    </Card>
  );
}

function LogoutAll() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logoutAll = useMutation({
    mutationFn: () => api<void>('/auth/logout-all', { body: {} }),
    onSuccess: () => {
      qc.clear();
      navigate('/login', { replace: true });
    },
  });
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-5">
      {logoutAll.error && (
        <Alert tone="danger">
          <ErrorMessage error={logoutAll.error} />
        </Alert>
      )}
      <Button
        variant="secondary"
        className="w-fit"
        onClick={() => logoutAll.mutate()}
        loading={logoutAll.isPending}
        icon={<LogOut className="size-4" aria-hidden />}
      >
        {t('settings.security.logoutAll')}
      </Button>
      <p className="text-sm text-ink-muted">{t('settings.security.logoutAllHint')}</p>
    </div>
  );
}
