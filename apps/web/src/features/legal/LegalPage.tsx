import { LEGAL_VERSIONS } from '@az/shared';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/ui/Alert';
import { PageTitle } from '../../components/ui/PageTitle';
import { formatDate } from '../../lib/format';

/** Enquanto VITE_LEGAL_DRAFT não for "false", mostra o aviso de rascunho. */
const IS_DRAFT = import.meta.env.VITE_LEGAL_DRAFT !== 'false';

export function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  const { t } = useTranslation();
  const sections = t(`legal.${doc}.sections`, { returnObjects: true });
  return (
    <article className="flex flex-col gap-6">
      <PageTitle
        text={t(`legal.${doc}.title`)}
        subtitle={t('legal.version', { date: formatDate(`${LEGAL_VERSIONS[doc]}T12:00:00Z`) })}
      />
      {IS_DRAFT && <Alert tone="warning">{t('legal.draftNotice')}</Alert>}
      {sections.map((s) => (
        <section key={s.title} className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{s.title}</h2>
          {s.body.map((p) => (
            <p key={p} className="text-[0.98rem] leading-relaxed text-ink">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
