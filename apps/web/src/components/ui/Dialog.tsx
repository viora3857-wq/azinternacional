import { useEffect, useId, useRef, type ReactNode } from 'react';

/** <dialog> nativo: foco preso, Esc fecha e o resto da página fica inerte, sem biblioteca. */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal?.();
    if (!open && el.open) el.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-line bg-surface p-6 text-ink shadow-card"
    >
      <h2 id={titleId} className="text-xl font-semibold">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </dialog>
  );
}
