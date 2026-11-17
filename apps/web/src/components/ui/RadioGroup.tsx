import { useId, type ReactNode } from 'react';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
}

interface RadioGroupProps<T extends string> {
  legend: ReactNode;
  name: string;
  value: T | null;
  options: Option<T>[];
  onChange: (value: T) => void;
  error?: ReactNode;
  /** Visual de controle segmentado (ex.: tema). */
  segmented?: boolean;
  hideLegend?: boolean;
}

export function RadioGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  error,
  segmented = false,
  hideLegend = false,
}: RadioGroupProps<T>) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset
      aria-describedby={errorId}
      data-invalid={error ? true : undefined}
      className="flex flex-col gap-2"
    >
      <legend className={hideLegend ? 'sr-only' : 'mb-2 text-sm font-semibold text-ink'}>
        {legend}
      </legend>
      <div
        className={
          segmented
            ? 'inline-flex w-fit rounded-lg border border-line-strong bg-surface p-1'
            : 'flex flex-col gap-2'
        }
      >
        {options.map((opt) => {
          const optId = `${id}-${opt.value}`;
          const checked = value === opt.value;
          return (
            <label
              key={opt.value}
              htmlFor={optId}
              className={
                segmented
                  ? `cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--az-focus)] ${checked ? 'bg-primary text-on-primary' : 'text-ink hover:bg-surface-2'}`
                  : `flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-[0.95rem] ${checked ? 'border-primary bg-info-soft' : 'border-line-strong bg-surface'} ${error ? 'border-danger' : ''}`
              }
            >
              <input
                id={optId}
                type="radio"
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                className={segmented ? 'sr-only' : 'size-5 accent-[var(--az-primary)]'}
              />
              {opt.label}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
