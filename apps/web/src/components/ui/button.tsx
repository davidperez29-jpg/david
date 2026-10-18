import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const styles: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast hover:bg-accent-hover',
  secondary: 'border border-border bg-bg text-text hover:bg-surface',
  ghost: 'text-text hover:bg-surface',
  danger: 'border border-danger text-danger hover:bg-danger hover:text-bg',
};

type Size = 'md' | 'lg' | 'sm';

/** The button look, also for links that act as buttons (e.g. «Enviar por WhatsApp»). */
export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className = '') {
  const sz =
    size === 'lg'
      ? 'h-12 px-6 text-base'
      : size === 'sm'
        ? 'h-8 px-3 text-sm'
        : 'h-10 px-4 text-sm';
  return `inline-flex items-center justify-center gap-2 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${sz} ${styles[variant]} ${className}`;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}
