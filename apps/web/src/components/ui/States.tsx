import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../lib/api';
import { Alert } from './Alert';
import { Button } from './Button';

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
      <span className="rounded-full bg-surface-2 p-3 text-ink-muted" aria-hidden="true">
        {icon}
      </span>
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {body && <p className="max-w-md text-[0.95rem] text-ink-muted">{body}</p>}
      {action}
    </div>
  );
}

/** Mensagem traduzida para qualquer erro (da API ou não). */
export function ErrorMessage({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const code = error instanceof ApiError ? error.code : 'UNKNOWN';
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <>
      <span>{t(`errors.${code}`)}</span>
      {requestId && (
        <span className="text-sm text-ink-muted">{t('errors.requestId', { id: requestId })}</span>
      )}
    </>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <Alert tone="danger" title={t('errors.title')}>
        <ErrorMessage error={error} />
      </Alert>
      {onRetry && (
        <Button
          variant="secondary"
          onClick={onRetry}
          icon={<RotateCcw className="size-4" aria-hidden />}
          className="w-fit"
        >
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
