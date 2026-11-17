import { totpCodeSchema, type MfaSetupResponse } from '@az/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorMessage } from '../../components/ui/States';
import { TextField } from '../../components/ui/TextField';
import { api } from '../../lib/api';
import { meKey } from '../../lib/queries';

export function MfaSection({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [qrFor, setQrFor] = useState<{ uri: string; url: string } | null>(null);
  const [code, setCode] = useState('');
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [notice, setNotice] = useState<'enabled' | 'disabled' | null>(null);
  const [disabling, setDisabling] = useState(false);

  const start = useMutation({
    mutationFn: () => api<MfaSetupResponse>('/auth/mfa/setup', { body: {} }),
    onSuccess: (data) => {
      setSetup(data);
      setNotice(null);
    },
  });

  useEffect(() => {
    if (!setup) return;
    let alive = true;
    const uri = setup.otpauthUri;
    QRCode.toDataURL(uri, { margin: 1, width: 192, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (alive) setQrFor({ uri, url });
      })
      .catch(() => undefined); // sem QR, a chave manual continua visível
    return () => {
      alive = false;
    };
  }, [setup]);
  const qr = setup && qrFor?.uri === setup.otpauthUri ? qrFor.url : null;

  const enable = useMutation({
    mutationFn: (c: string) => api<void>('/auth/mfa/enable', { body: { code: c } }),
    onSuccess: async () => {
      setSetup(null);
      setCode('');
      setNotice('enabled');
      await qc.invalidateQueries({ queryKey: meKey });
    },
  });

  const disable = useMutation({
    mutationFn: (c: string) => api<void>('/auth/mfa/disable', { body: { code: c } }),
    onSuccess: async () => {
      setDisabling(false);
      setCode('');
      setNotice('disabled');
      await qc.invalidateQueries({ queryKey: meKey });
    },
  });

  function submitCode(e: FormEvent, action: (c: string) => void) {
    e.preventDefault();
    const ok = totpCodeSchema.safeParse(code).success;
    setCodeInvalid(!ok);
    if (ok) action(code);
  }

  const error = start.error ?? enable.error ?? disable.error;
  const codeField = (
    <TextField
      label={t('auth.mfa.codeLabel')}
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
      error={codeInvalid ? t('validation.code') : undefined}
      className="max-w-48"
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-sans text-base font-semibold">{t('mfa.title')}</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${enabled ? 'bg-success-soft text-success' : 'bg-surface-2 text-ink-muted'}`}
        >
          {enabled ? t('mfa.on') : t('mfa.off')}
        </span>
      </div>
      <p className="text-[0.95rem] text-ink-muted">{t('mfa.description')}</p>

      {notice === 'enabled' && <Alert tone="success">{t('mfa.enabledToast')}</Alert>}
      {notice === 'disabled' && <Alert tone="success">{t('mfa.disabledToast')}</Alert>}
      {error && (
        <Alert tone="danger">
          <ErrorMessage error={error} />
        </Alert>
      )}

      {!enabled && !setup && (
        <Button className="w-fit" onClick={() => start.mutate()} loading={start.isPending}>
          {t('mfa.enable')}
        </Button>
      )}

      {!enabled && setup && (
        <form
          noValidate
          onSubmit={(e) => submitCode(e, (c) => enable.mutate(c))}
          className="flex flex-col gap-4 rounded-lg border border-line bg-surface-2 p-4"
        >
          <p className="text-[0.95rem]">{t('mfa.setupStep1')}</p>
          {qr ? (
            <img
              src={qr}
              alt={t('mfa.qrAlt')}
              width={192}
              height={192}
              className="rounded-md bg-white p-2"
            />
          ) : (
            <Skeleton className="size-48" />
          )}
          <div className="flex flex-col gap-1">
            <p className="text-sm text-ink-muted">{t('mfa.setupManual')}</p>
            <code
              data-testid="mfa-secret"
              className="w-fit rounded bg-surface px-2 py-1 font-mono text-sm tracking-wider break-all"
            >
              {setup.secret}
            </code>
          </div>
          <p className="text-[0.95rem]">{t('mfa.setupStep2')}</p>
          {codeField}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={enable.isPending}>
              {t('mfa.confirm')}
            </Button>
            <Button variant="ghost" onClick={() => setSetup(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      )}

      {enabled && !disabling && (
        <Button variant="secondary" className="w-fit" onClick={() => setDisabling(true)}>
          {t('mfa.disable')}
        </Button>
      )}

      {enabled && disabling && (
        <form
          noValidate
          onSubmit={(e) => submitCode(e, (c) => disable.mutate(c))}
          className="flex flex-col gap-4 rounded-lg border border-line bg-surface-2 p-4"
        >
          <p className="font-semibold">{t('mfa.disableTitle')}</p>
          <p className="text-[0.95rem] text-ink-muted">{t('mfa.disableBody')}</p>
          {codeField}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="danger" loading={disable.isPending}>
              {t('mfa.disable')}
            </Button>
            <Button variant="ghost" onClick={() => setDisabling(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
