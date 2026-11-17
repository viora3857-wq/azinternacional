import { LOCALES, type Locale } from '@az/shared';
import { Languages } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { isLocale } from '../i18n';

export function LanguageSwitcher({ onPersist }: { onPersist?: (l: Locale) => void }) {
  const { t, i18n } = useTranslation();
  const id = useId();
  return (
    <div className="flex items-center gap-1.5">
      <Languages className="size-4 text-ink-muted" aria-hidden />
      <label htmlFor={id} className="sr-only">
        {t('common.language')}
      </label>
      <select
        id={id}
        value={i18n.language}
        onChange={(e) => {
          const value = e.target.value;
          if (!isLocale(value)) return;
          void i18n.changeLanguage(value);
          onPersist?.(value);
        }}
        className="min-h-9 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {t(`languages.${l}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
