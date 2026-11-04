import { cn } from './cn';

/** Barra de progreso accesible (valor sobre total). */
export function Meter({
  value,
  max,
  label,
  tone = 'sun',
  className,
}: {
  value: number;
  max: number;
  label: string;
  tone?: 'sun' | 'leaf' | 'ink';
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = tone === 'leaf' ? 'bg-leaf-500' : tone === 'ink' ? 'bg-ink-900' : 'bg-sun-500';
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-2.5 w-full overflow-hidden rounded-full bg-cream-200', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', color)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
