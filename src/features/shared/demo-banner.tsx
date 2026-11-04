import { FlaskConical } from 'lucide-react';
import { cn } from '@/ui/cn';

/** Aviso permanente mientras la aplicación funcione con datos de demostración. */
export function DemoBanner({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <p
      role="note"
      className={cn(
        'flex items-center justify-center gap-2 bg-ink-900 px-4 text-center font-medium text-cream-50',
        compact ? 'py-1.5 text-xs' : 'py-2 text-sm',
        className,
      )}
    >
      <FlaskConical aria-hidden className="size-4 shrink-0 text-sun-400" />
      <span>
        <strong className="font-bold text-sun-300">Demostración:</strong> datos ficticios, sin
        inicio de sesión real.
        {compact ? null : ' Nada de lo que hagas se guarda.'}
      </span>
    </p>
  );
}
