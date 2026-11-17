import { ChartLine, CircleCheck, Circle, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMeContext } from '../../app/me-context';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';
import { PageTitle } from '../../components/ui/PageTitle';
import { EmptyState } from '../../components/ui/States';

export function DashboardPage() {
  const { t } = useTranslation();
  const me = useMeContext();
  const name = me.displayName ?? me.email;

  return (
    <>
      <PageTitle text={t('dashboard.greeting', { name })} subtitle={t('dashboard.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card title={t('dashboard.stepsTitle')}>
          <ul className="flex flex-col gap-4">
            <li className="flex items-start gap-3">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              <span>{t('dashboard.stepAccount')}</span>
            </li>
            <li className="flex items-start gap-3">
              {me.mfaEnabled ? (
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden />
              )}
              <span className="flex flex-col gap-1">
                {me.mfaEnabled ? t('dashboard.stepMfaDone') : t('dashboard.stepMfa')}
                {!me.mfaEnabled && (
                  <Link
                    to="/settings#security"
                    className="w-fit font-semibold text-primary underline underline-offset-4"
                  >
                    {t('dashboard.stepMfaAction')}
                  </Link>
                )}
              </span>
            </li>
          </ul>
        </Card>

        <Card title={t('dashboard.progressTitle')}>
          <EmptyState
            icon={<ChartLine className="size-6" />}
            title={t('dashboard.progressEmptyTitle')}
            body={t('dashboard.progressEmptyBody')}
          />
        </Card>
      </div>
      <div className="mt-6">
        <Alert tone="info">{t('dashboard.modulesNotice')}</Alert>
      </div>
    </>
  );
}
