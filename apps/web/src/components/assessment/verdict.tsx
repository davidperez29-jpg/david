import { Badge } from '@/components/ui/card';

type Verdict =
  | 'unknown_error'
  | 'within_error'
  | 'possible_change'
  | 'probable_improvement'
  | 'probable_decline'
  | 'probable_change';

const TONE: Record<Verdict, 'ok' | 'warn' | 'danger' | 'neutral' | 'accent'> = {
  unknown_error: 'neutral',
  within_error: 'neutral',
  possible_change: 'warn',
  probable_improvement: 'ok',
  probable_decline: 'danger',
  probable_change: 'accent',
};

const SHORT: Record<Verdict, string> = {
  unknown_error: 'Error de medida desconocido',
  within_error: 'Dentro del error de medida',
  possible_change: 'Posible cambio (repetir)',
  probable_improvement: 'Mejora probable',
  probable_decline: 'Empeoramiento probable',
  probable_change: 'Cambio probable',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v);

export function VerdictBadge({ verdict }: { verdict: string }) {
  return (
    <Badge tone={TONE[verdict as Verdict] ?? 'neutral'}>
      {SHORT[verdict as Verdict] ?? verdict}
    </Badge>
  );
}

export function ChangeLine({
  change,
  unit,
}: {
  change: {
    delta: number;
    deltaPercent: number | null;
    verdict: string;
    error: { te: number; mdc95: number; label: string; basis: string } | null;
    warnings: string[];
  };
  unit: string;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular-nums">
          Δ {fmt(change.delta)} {unit}
          {change.deltaPercent != null ? ` (${fmt(change.deltaPercent)} %)` : ''}
        </span>
        <VerdictBadge verdict={change.verdict} />
      </div>
      {change.error ? (
        <span className="text-muted">
          Error típico ±{change.error.te} {unit} · MDC95 {change.error.mdc95} {unit} (
          {change.error.basis}; {change.error.label})
        </span>
      ) : null}
      {change.warnings.map((w) => (
        <span key={w} className="text-muted">
          {w}
        </span>
      ))}
    </div>
  );
}
