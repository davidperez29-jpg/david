import { FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/ui/cn';

/**
 * Aviso permanente mientras la aplicación funcione con datos de demostración (P-87).
 * Con `viewer`, dice como quién se está viendo la app y ofrece cambiar («Entrar como…», B0).
 */
export function DemoBanner({
  compact = false,
  viewer,
  className,
}: {
  compact?: boolean;
  viewer?: string;
  className?: string;
}) {
  return (
    <p
      role="note"
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 bg-ink-900 px-4 text-center font-medium text-cream-50',
        compact ? 'py-1.5 text-xs' : 'py-2 text-sm',
        className,
      )}
    >
      <FlaskConical aria-hidden className="size-4 shrink-0 text-sun-400" />
      <span>
        <strong className="font-bold text-sun-300">Modo demostración:</strong> datos ficticios en
        este equipo, sin inicio de sesión real.
        {viewer ? <> Estás viendo la app como {viewer}.</> : null}
      </span>
      {viewer ? (
        <Link
          href="/#entrar"
          className="font-bold text-sun-300 underline underline-offset-2 hover:text-sun-200"
        >
          Cambiar
        </Link>
      ) : null}
    </p>
  );
}
