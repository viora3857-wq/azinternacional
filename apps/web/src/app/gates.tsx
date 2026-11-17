import type { AccountStatus, Me } from '@az/shared';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet } from 'react-router-dom';
import { PageSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/States';
import { ApiError } from '../lib/api';
import { homeFor, useMe } from '../lib/queries';
import { useMeContext } from './me-context';

/** Exige sessão. Sem sessão vai para /login; outros erros mostram estado de erro com retry. */
export function SessionGate() {
  const { i18n } = useTranslation();
  const me = useMe();
  const synced = useRef(false);

  useEffect(() => {
    // Na primeira carga, o idioma salvo na conta vale mais que o do navegador.
    if (me.data && !synced.current) {
      synced.current = true;
      if (me.data.locale !== i18n.language) void i18n.changeLanguage(me.data.locale);
    }
  }, [me.data, i18n]);

  if (me.isPending) return <PageSkeleton />;
  if (me.error) {
    if (me.error instanceof ApiError && me.error.status === 401)
      return <Navigate to="/login" replace />;
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </div>
    );
  }
  return <Outlet />;
}

/** Mostra a rota só no status certo; senão leva para a tela correta do fluxo. */
export function StatusGate({
  need,
  children,
}: {
  need: AccountStatus;
  children: (me: Me) => React.ReactNode;
}) {
  const me = useMeContext();
  if (me.status !== need) return <Navigate to={homeFor(me.status)} replace />;
  return <>{children(me)}</>;
}
