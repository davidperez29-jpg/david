/**
 * Small dependency-free SVG charts (§11.6): time series with a measurement-error band around the
 * baseline, and before/after bars. Never mixes units; radar charts are intentionally absent.
 */

const fmt = (v: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(v);
const shortDate = (d: string) =>
  new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${d}T00:00:00Z`),
  );

export function SeriesChart({
  points,
  unit,
  errorBand,
  label,
}: {
  points: { on: string; value: number }[];
  unit: string;
  /** Typical error around the first value (shaded band = "dentro del error"). */
  errorBand?: number | null;
  label: string;
}) {
  if (points.length === 0) return null;
  const W = 320;
  const H = 140;
  const P = { l: 44, r: 12, t: 12, b: 26 };
  const vals = points.map((p) => p.value);
  const base = points[0]!.value;
  const lo = Math.min(...vals, errorBand ? base - errorBand : Infinity);
  const hi = Math.max(...vals, errorBand ? base + errorBand : -Infinity);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.15;
  const y0 = lo - pad;
  const y1 = hi + pad;
  const x = (i: number) =>
    P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i / (points.length - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - (v - y0) / (y1 - y0)) * (H - P.t - P.b);
  const path = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${label}: ${points.map((p) => `${shortDate(p.on)} ${fmt(p.value)} ${unit}`).join('; ')}`}
      className="h-auto w-full max-w-md text-accent"
    >
      {errorBand ? (
        <rect
          x={P.l}
          width={W - P.l - P.r}
          y={y(base + errorBand)}
          height={Math.max(1, y(base - errorBand) - y(base + errorBand))}
          className="fill-current opacity-10"
        />
      ) : null}
      <line x1={P.l} x2={P.l} y1={P.t} y2={H - P.b} className="stroke-border" />
      <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} className="stroke-border" />
      <text x={P.l - 6} y={y(y1 - pad) + 4} textAnchor="end" className="fill-muted text-[10px]">
        {fmt(hi)}
      </text>
      <text x={P.l - 6} y={y(y0 + pad) + 4} textAnchor="end" className="fill-muted text-[10px]">
        {fmt(lo)}
      </text>
      <path d={path} fill="none" className="stroke-current" strokeWidth={2} />
      {points.map((p, i) => (
        <g key={`${p.on}-${i}`}>
          <circle cx={x(i)} cy={y(p.value)} r={3.5} className="fill-current" />
          <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted text-[10px]">
            {shortDate(p.on)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function BeforeAfterBars({
  before,
  after,
  unit,
  label,
}: {
  before: { on: string; value: number };
  after: { on: string; value: number };
  unit: string;
  label: string;
}) {
  const max = Math.max(Math.abs(before.value), Math.abs(after.value)) || 1;
  const row = (title: string, v: number, strong: boolean) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-muted">{title}</span>
      <span className="h-3 flex-1 rounded bg-surface">
        <span
          className={`block h-3 rounded ${strong ? 'bg-accent' : 'bg-muted/40'}`}
          style={{ width: `${(Math.abs(v) / max) * 100}%` }}
        />
      </span>
      <span className="w-20 shrink-0 text-right tabular-nums">
        {fmt(v)} {unit}
      </span>
    </div>
  );
  return (
    <figure className="flex flex-col gap-1" aria-label={label}>
      {row(shortDate(before.on), before.value, false)}
      {row(shortDate(after.on), after.value, true)}
    </figure>
  );
}
