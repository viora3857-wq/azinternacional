import { useTranslation } from 'react-i18next';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-md bg-skeleton bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.35),transparent)] bg-[length:200%_100%] [animation:az-shimmer_1.6s_linear_infinite] ${className}`}
    />
  );
}

/** Esqueleto de página inteira, anunciado como "Carregando" para leitores de tela. */
export function PageSkeleton() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6"
    >
      <span className="sr-only">{t('common.loading')}</span>
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="mt-4 h-40 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
