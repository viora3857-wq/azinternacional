import type { Me } from '@az/shared';
import { LayoutDashboard, LogOut, Menu, Settings, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { usePersistLocale, useSignOut } from '../../lib/session-hooks';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { Logo } from '../Logo';
import { Button } from '../ui/Button';
import { LegalFooter } from './LegalFooter';

export function AppShell({ me }: { me: Me }) {
  const { t } = useTranslation();
  const location = useLocation();
  // O menu móvel fica aberto só na rota em que foi aberto: navegar fecha sem precisar de efeito.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const menuOpen = openAt === location.pathname;
  const signOut = useSignOut();
  const persistLocale = usePersistLocale();

  const links = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/settings', label: t('nav.settings'), icon: Settings, end: false },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        {t('common.skipToContent')}
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="rounded-md">
            <Logo />
          </Link>

          <nav aria-label={t('nav.main')} className="hidden md:block">
            <ul className="flex items-center gap-1">
              {links.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-[0.95rem] font-semibold ${isActive ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:text-ink'}`
                    }
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <LanguageSwitcher onPersist={persistLocale} />
            <span className="max-w-40 truncate text-sm text-ink-muted">
              {me.displayName ?? me.email}
            </span>
            <Button
              variant="ghost"
              onClick={() => signOut.mutate()}
              loading={signOut.isPending}
              icon={<LogOut className="size-4" aria-hidden />}
            >
              {t('common.signOut')}
            </Button>
          </div>

          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-md border border-line-strong md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setOpenAt(menuOpen ? null : location.pathname)}
          >
            {menuOpen ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
            <span className="sr-only">
              {menuOpen ? t('common.closeMenu') : t('common.openMenu')}
            </span>
          </button>
        </div>

        {menuOpen && (
          <div id="mobile-menu" className="border-t border-line px-4 pb-4 md:hidden">
            <nav aria-label={t('nav.main')}>
              <ul className="flex flex-col py-2">
                {links.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        `flex min-h-11 items-center gap-3 rounded-md px-2 font-semibold ${isActive ? 'text-ink' : 'text-ink-muted'}`
                      }
                    >
                      <Icon className="size-5" aria-hidden />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <LanguageSwitcher onPersist={persistLocale} />
              <Button
                variant="secondary"
                onClick={() => signOut.mutate()}
                loading={signOut.isPending}
                icon={<LogOut className="size-4" aria-hidden />}
              >
                {t('common.signOut')}
              </Button>
            </div>
          </div>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      <LegalFooter />
    </div>
  );
}
