import { cn } from '@/ui/cn';

/** Símbolo de TrainPro: una línea de progreso que sube hacia un punto (la persona). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden focusable="false">
      <rect width="32" height="32" rx="10" fill="#FFD23F" />
      <path
        d="M6.5 19.5h5l2.6-6.4 3.6 9.8 2.6-6.4h5.2"
        fill="none"
        stroke="#2B2116"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23.6" cy="9.4" r="2.6" fill="#2B2116" />
    </svg>
  );
}

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-xl font-extrabold tracking-tight text-ink-900">
          Train<span className="text-sun-700">Pro</span>
        </span>
        {subtitle ? (
          <span className="mt-0.5 text-[0.7rem] font-semibold text-ink-500">{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}
