import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/ui/PageTitle';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-4">
      <PageTitle text={t('notFound.title')} subtitle={t('notFound.body')} />
      <Link to="/" className="w-fit font-semibold text-primary underline underline-offset-4">
        {t('notFound.home')}
      </Link>
    </section>
  );
}
