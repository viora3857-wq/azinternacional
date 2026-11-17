import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export function TextField({ label, hint, error, className = '', ...input }: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={`min-h-11 rounded-lg border bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-muted ${error ? 'border-danger' : 'border-line-strong'}`}
        {...input}
      />
      {error && (
        <p id={errorId} className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
