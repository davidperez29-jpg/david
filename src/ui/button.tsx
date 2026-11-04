import Link, { type LinkProps } from 'next/link';
import { type ComponentProps, type ReactNode } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'dark' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-sun-400 text-ink-900 hover:bg-sun-300 shadow-soft',
  dark: 'bg-ink-900 text-cream-50 hover:bg-ink-700 shadow-soft',
  secondary: 'bg-white text-ink-900 border border-line hover:border-ink-300 hover:bg-cream-50',
  ghost: 'text-ink-700 hover:bg-cream-200 hover:text-ink-900',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-5 text-[0.95rem] gap-2 rounded-2xl',
  lg: 'h-14 px-6 text-base gap-2.5 rounded-2xl',
};

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex items-center justify-center font-semibold transition-colors select-none',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface StyleProps {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & StyleProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink<Href extends string>({
  variant,
  size,
  className,
  children,
  ...props
}: LinkProps<Href> & StyleProps & { className?: string; children: ReactNode }) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
