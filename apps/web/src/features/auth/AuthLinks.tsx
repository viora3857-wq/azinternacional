import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export const linkClass = 'font-semibold text-primary underline underline-offset-4';

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={linkClass}>
      {children}
    </Link>
  );
}
