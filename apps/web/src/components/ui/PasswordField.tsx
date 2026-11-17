import { Eye, EyeOff } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

/** Campo de senha com botão mostrar/ocultar acessível (aria-pressed + rótulo que muda). */
export function PasswordField({
  label,
  hint,
  error,
  className = '',
  ...input
}: PasswordFieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const [visible, setVisible] = useState(false);
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
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          className={`min-h-11 w-full rounded-lg border bg-surface py-2 pr-12 pl-3 text-base text-ink ${error ? 'border-danger' : 'border-line-strong'}`}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-muted hover:text-ink"
        >
          {visible ? (
            <EyeOff className="size-5" aria-hidden />
          ) : (
            <Eye className="size-5" aria-hidden />
          )}
          <span className="sr-only">{visible ? t('password.hide') : t('password.show')}</span>
        </button>
      </div>
      {error && (
        <p id={errorId} className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
