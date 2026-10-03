import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

const control =
  'w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted aria-[invalid=true]:border-danger';

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  error?: string[] | string | undefined;
  hint?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  const msg = Array.isArray(error) ? error.join(' ') : error;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !msg ? <p className="text-xs text-muted">{hint}</p> : null}
      {msg ? (
        <p role="alert" className="text-xs text-danger">
          {msg}
        </p>
      ) : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} h-10 ${props.className ?? ''}`} />;
}

export function Select({
  options,
  placeholder,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select {...props} className={`${control} h-10 ${props.className ?? ''}`}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${control} ${props.className ?? ''}`} />;
}
