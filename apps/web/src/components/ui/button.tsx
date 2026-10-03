import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const styles: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast hover:opacity-90',
  secondary: 'border border-border bg-bg text-text hover:bg-surface',
  ghost: 'text-text hover:bg-surface',
  danger: 'border border-danger text-danger hover:bg-danger hover:text-white',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg' | 'sm' }) {
  const sz =
    size === 'lg'
      ? 'h-12 px-6 text-base'
      : size === 'sm'
        ? 'h-8 px-3 text-sm'
        : 'h-10 px-4 text-sm';
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${sz} ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
