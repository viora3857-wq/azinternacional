import { useTranslation } from 'react-i18next';

/** Marca: "A" de atlas com o ponto de destino. SVG próprio, sem dependência externa. */
export function Logo({ inverted = false }: { inverted?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
        <rect
          width="32"
          height="32"
          rx="7"
          fill={inverted ? 'var(--az-on-brand)' : 'var(--az-ink)'}
        />
        <path
          d="M8 23 14.5 9h3L24 23h-3.2l-1.3-3h-7l-1.3 3H8Zm5.3-5.6h5.4L16 11.3l-2.7 6.1Z"
          fill={inverted ? 'var(--az-brand)' : 'var(--az-bg)'}
        />
        <circle cx="24" cy="9" r="2.2" fill="var(--az-accent)" />
      </svg>
      <span
        className={`font-display text-lg font-semibold tracking-tight ${inverted ? 'text-on-brand' : 'text-ink'}`}
      >
        {t('common.appName')}
      </span>
    </span>
  );
}
