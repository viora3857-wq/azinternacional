import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function LegalFooter() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-line px-4 py-5 text-sm text-ink-muted sm:px-8">
      <nav aria-label={t('nav.footer')} className="flex flex-wrap gap-x-5 gap-y-2">
        <Link to="/privacy" className="underline underline-offset-4 hover:text-ink">
          {t('nav.privacy')}
        </Link>
        <Link to="/terms" className="underline underline-offset-4 hover:text-ink">
          {t('nav.terms')}
        </Link>
      </nav>
    </footer>
  );
}
