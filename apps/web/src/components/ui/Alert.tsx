import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const STYLES: Record<Tone, { box: string; icon: ReactNode }> = {
  info: {
    box: 'bg-info-soft border-line',
    icon: <Info className="size-5 text-primary" aria-hidden />,
  },
  success: {
    box: 'bg-success-soft border-line',
    icon: <CircleCheck className="size-5 text-success" aria-hidden />,
  },
  warning: {
    box: 'bg-warning-soft border-line',
    icon: <TriangleAlert className="size-5 text-warning" aria-hidden />,
  },
  danger: {
    box: 'bg-danger-soft border-line',
    icon: <CircleAlert className="size-5 text-danger" aria-hidden />,
  },
};

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
}) {
  const s = STYLES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-lg border p-4 text-ink ${s.box}`}
    >
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="flex flex-col gap-1 text-[0.95rem]">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
