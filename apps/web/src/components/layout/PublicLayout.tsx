import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { Logo } from '../Logo';
import { ThemeSwitcher } from '../ThemeSwitcher';
import { LegalFooter } from './LegalFooter';

/** Telas públicas: painel de marca à esquerda (desktop) e conteúdo à direita. */
export function PublicLayout() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        {t('common.skipToContent')}
      </a>
      <aside className="relative hidden overflow-hidden bg-brand p-10 text-on-brand lg:flex lg:flex-col lg:justify-between">
        <Meridians />
        <Link to="/login" className="relative w-fit rounded-md">
          <Logo inverted />
        </Link>
        <p className="relative max-w-sm font-display text-[2.4rem] leading-[1.1] font-medium">
          {t('common.tagline')}
        </p>
        <span aria-hidden="true" className="relative h-px w-24 bg-brand-accent" />
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <Link to="/login" className="rounded-md lg:invisible">
            <Logo />
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </header>
        <main id="main" className="flex flex-1 justify-center px-4 py-8 sm:px-8 lg:items-center">
          <div className="w-full max-w-lg">
            <Outlet />
          </div>
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}

/** Linhas de meridiano: detalhe gráfico do painel de marca. */
function Meridians() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full opacity-[0.12]"
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {[60, 120, 180, 240, 300].map((rx) => (
        <ellipse
          key={rx}
          cx="420"
          cy="300"
          rx={rx}
          ry="420"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
      {[150, 300, 450].map((y) => (
        <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="currentColor" strokeWidth="1" />
      ))}
    </svg>
  );
}
