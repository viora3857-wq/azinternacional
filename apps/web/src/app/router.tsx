import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PublicLayout } from '../components/layout/PublicLayout';
import { PageSkeleton } from '../components/ui/Skeleton';
import { LoginPage } from '../features/auth/LoginPage';
import { MfaPage } from '../features/auth/MfaPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { MagicLinkPage } from '../features/auth/MagicLinkPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { TokenLoginPage } from '../features/auth/TokenLoginPage';
import { NotFoundPage } from '../features/misc/NotFoundPage';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { SessionGate, StatusGate } from './gates';
import { RouteError } from './RouteError';

// Telas fora do caminho de login são carregadas sob demanda para o bundle inicial ficar leve.
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    HydrateFallback: PageSkeleton,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/login/link', element: <MagicLinkPage /> },
      { path: '/login/verify', element: <TokenLoginPage kind="magic" /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/verify-email', element: <TokenLoginPage kind="email" /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/login/mfa', element: <MfaPage /> },
      {
        path: '/privacy',
        lazy: () =>
          import('../features/legal/LegalPage').then((m) => ({
            Component: () => <m.LegalPage doc="privacy" />,
          })),
      },
      {
        path: '/terms',
        lazy: () =>
          import('../features/legal/LegalPage').then((m) => ({
            Component: () => <m.LegalPage doc="terms" />,
          })),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <SessionGate />,
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          {
            path: '/onboarding',
            element: (
              <StatusGate need="onboarding_required">
                {(me) => <OnboardingPage me={me} />}
              </StatusGate>
            ),
          },
        ],
      },
      {
        element: <StatusGate need="active">{(me) => <AppShell me={me} />}</StatusGate>,
        children: [
          {
            index: true,
            lazy: () =>
              import('../features/dashboard/DashboardPage').then((m) => ({
                Component: m.DashboardPage,
              })),
          },
          {
            path: '/settings',
            lazy: () =>
              import('../features/settings/SettingsPage').then((m) => ({
                Component: m.SettingsPage,
              })),
          },
        ],
      },
    ],
  },
]);
