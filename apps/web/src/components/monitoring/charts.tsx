/**
 * Weekly internal load (sRPE × minutes, AU). One series, one colour (accent); the title names it,
 * so no legend. Each bar has a native tooltip and the same numbers are in the table beside it.
 */
const fmt = (v: number) => new Intl.NumberFormat('es-ES').format(v);
const shortDate = (d: string) =>
  new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${d}T00:00:00Z`),
  );

export function WeeklyLoadChart({
  weeks,
}: {
  weeks: { weekStart: string; load: number; sessions: number }[];
}) {
  if (!weeks.length) return null;
  const W = 360;
  const H = 150;
  const P = { l: 40, r: 8, t: 10, b: 24 };
  const max = Math.max(...weeks.map((w) => w.load), 1);
  const step = (W - P.l - P.r) / weeks.length;
  const bw = Math.max(6, step - 6);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Carga semanal (UA): ${weeks.map((w) => `semana del ${shortDate(w.weekStart)} ${fmt(w.load)}`).join('; ')}`}
      className="h-auto w-full max-w-lg text-accent"
    >
      <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} className="stroke-border" />
      <text x={P.l - 6} y={P.t + 8} textAnchor="end" className="fill-muted text-[10px]">
        {fmt(max)}
      </text>
      <text x={P.l - 6} y={H - P.b} textAnchor="end" className="fill-muted text-[10px]">
        0
      </text>
      {weeks.map((w, i) => {
        const x = P.l + i * step + (step - bw) / 2;
        const top = y(w.load);
        const h = H - P.b - top;
        return (
          <g key={w.weekStart}>
            <title>
              {`Semana del ${shortDate(w.weekStart)}: ${fmt(w.load)} UA (${w.sessions} sesiones)`}
            </title>
            {/* Larger invisible hit target than the bar. */}
            <rect
              x={P.l + i * step}
              y={P.t}
              width={step}
              height={H - P.t - P.b}
              fill="transparent"
            />
            {h > 0 ? (
              <path
                d={`M${x},${H - P.b} V${top + Math.min(4, h)} Q${x},${top} ${x + Math.min(4, bw / 2)},${top} H${x + bw - Math.min(4, bw / 2)} Q${x + bw},${top} ${x + bw},${top + Math.min(4, h)} V${H - P.b} Z`}
                className="fill-current"
              />
            ) : null}
            {i % 2 === weeks.length % 2 || weeks.length <= 6 ? (
              <text
                x={P.l + i * step + step / 2}
                y={H - 8}
                textAnchor="middle"
                className="fill-muted text-[10px]"
              >
                {shortDate(w.weekStart)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
