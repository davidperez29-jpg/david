import {
  cloneElement,
  isValidElement,
  type ComponentProps,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
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
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;
  const describedBy = msg ? errorId : hint ? hintId : undefined;
  // The control (the child with id = htmlFor) is told about its error or hint (phase 18).
  type ControlProps = { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: unknown };
  const control =
    isValidElement<ControlProps>(children) && children.props.id === htmlFor
      ? cloneElement(children, {
          'aria-invalid': msg ? true : children.props['aria-invalid'],
          'aria-describedby':
            [children.props['aria-describedby'], describedBy].filter(Boolean).join(' ') ||
            undefined,
        })
      : children;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {control}
      {hint && !msg ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {msg ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {msg}
        </p>
      ) : null}
    </div>
  );
}

/** `ref` is a plain prop in React 19 (used to move focus back to a field). */
export function Input(props: ComponentProps<'input'>) {
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
