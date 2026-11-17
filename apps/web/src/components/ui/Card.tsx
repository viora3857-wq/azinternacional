import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  as?: 'section' | 'div' | 'article';
  headingLevel?: 2 | 3;
}

export function Card({
  title,
  description,
  as: Tag = 'section',
  headingLevel = 2,
  className = '',
  children,
  ...rest
}: CardProps) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Tag
      className={`rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card sm:p-6 ${className}`}
      {...rest}
    >
      {title && <H className="text-xl font-semibold text-ink">{title}</H>}
      {description && <p className="mt-1 text-[0.95rem] text-ink-muted">{description}</p>}
      {(title || description) && children ? <div className="mt-5">{children}</div> : children}
    </Tag>
  );
}
