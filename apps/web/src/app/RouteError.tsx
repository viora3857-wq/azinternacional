import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRouteError } from 'react-router-dom';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';

/** Erro inesperado de renderização: mensagem traduzida e caminho de saída, sem stack trace na tela. */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <main id="main" className="mx-auto flex max-w-lg flex-col gap-4 p-6 pt-16">
      <h1 className="text-3xl font-semibold">{t('errors.title')}</h1>
      <Alert tone="danger">{t('errors.UNKNOWN')}</Alert>
      <Button
        className="w-fit"
        variant="secondary"
        onClick={() => window.location.reload()}
        icon={<RotateCcw className="size-4" aria-hidden />}
      >
        {t('common.retry')}
      </Button>
    </main>
  );
}
