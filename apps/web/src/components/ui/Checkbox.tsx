import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: ReactNode;
  error?: ReactNode;
}

export function Checkbox({ label, error, ...input }: CheckboxProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="mt-0.5 size-5 shrink-0 accent-[var(--az-primary)]"
          {...input}
        />
        <label htmlFor={id} className="text-[0.95rem] text-ink">
          {label}
        </label>
      </div>
      {error && (
        <p id={errorId} className="pl-8 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
