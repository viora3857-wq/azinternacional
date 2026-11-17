import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Título da página: atualiza <title> e leva o foco ao h1 quando a rota muda,
 * para que leitores de tela anunciem a nova página.
 */
export function PageTitle({
  children,
  text,
  subtitle,
}: {
  children?: ReactNode;
  text: string;
  subtitle?: ReactNode;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${text} · ${t('common.appName')}`;
    ref.current?.focus({ preventScroll: true });
  }, [text, t]);
  return (
    <header className="mb-6 flex flex-col gap-2">
      <h1
        ref={ref}
        tabIndex={-1}
        className="text-3xl font-semibold text-ink outline-none sm:text-[2.25rem] sm:leading-tight"
      >
        {children ?? text}
      </h1>
      {subtitle && <p className="max-w-2xl text-[1.05rem] text-ink-muted">{subtitle}</p>}
    </header>
  );
}
