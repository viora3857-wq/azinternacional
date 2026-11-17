import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { ErrorMessage } from '../../components/ui/States';
import { TextField } from '../../components/ui/TextField';
import { api } from '../../lib/api';

/** LGPD: exclusão da conta e de todos os dados, pelo próprio titular. */
export function DeleteAccountSection({ email, bare = false }: { email: string; bare?: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');

  const del = useMutation({
    mutationFn: (confirmEmail: string) => api<void>('/account/delete', { body: { confirmEmail } }),
    onSuccess: () => {
      qc.clear();
      navigate('/login', { replace: true });
    },
  });

  const matches = confirm.trim().toLowerCase() === email;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (matches) del.mutate(email);
  }

  const content = (
    <div className="flex flex-col gap-4">
      <Link to="/privacy" className="w-fit font-semibold text-primary underline underline-offset-4">
        {t('settings.privacy.policy')}
      </Link>
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <h3 className="font-sans text-base font-semibold">{t('settings.privacy.deleteTitle')}</h3>
        <p className="text-[0.95rem] text-ink-muted">{t('settings.privacy.deleteBody')}</p>
        <Button
          variant="danger"
          className="mt-2 w-fit"
          onClick={() => setOpen(true)}
          icon={<Trash2 className="size-4" aria-hidden />}
        >
          {t('settings.privacy.deleteButton')}
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setConfirm('');
          del.reset();
        }}
        title={t('settings.privacy.dialogTitle')}
      >
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <p className="text-[0.95rem]">{t('settings.privacy.dialogBody', { email })}</p>
          {del.error && (
            <Alert tone="danger">
              <ErrorMessage error={del.error} />
            </Alert>
          )}
          <TextField
            label={t('settings.privacy.confirmLabel')}
            type="email"
            name="confirmEmail"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="danger" disabled={!matches} loading={del.isPending}>
              {t('settings.privacy.confirm')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );

  return bare ? content : <Card title={t('settings.privacy.title')}>{content}</Card>;
}
