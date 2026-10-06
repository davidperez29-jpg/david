/**
 * Radar (restructure phase 5, docs/EVALUATION_SYSTEM.md §4): one axis per dimension, all on the
 * same standardized scale (never raw units). Server-rendered SVG, no script.
 * - Layer B (current) solid accent with a light fill; layer A (before) dashed muted line: identity
 *   never relies on colour alone, and the legend names both.
 * - The neutral ring (group mean, reference, P50 or 100 %) is drawn thicker and labelled.
 * - No data is a gap: the outline is broken there and the axis says «sin dato».
 * - Values are clipped to the drawing range; the real ones are in the tooltip and the table.
 */
import { useId } from 'react';
import { radius, type Scale } from '@tp/domain';

export interface RadarLayer {
  label: string;
  values: (number | null)[];
  variant: 'current' | 'previous';
}

const fmt = (v: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(v);

export function RadarChart({
  axes,
  layers,
  scale,
  neutralLabel,
  title,
  description,
}: {
  axes: string[];
  layers: RadarLayer[];
  scale: { value: Scale; neutral: number; range: [number, number] };
  neutralLabel: string;
  title: string;
  description: string;
}) {
  const uid = useId();
  const S = 360;
  const C = S / 2;
  const R = 120;
  const n = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pt = (i: number, r: number) =>
    [C + Math.cos(angle(i)) * r * R, C + Math.sin(angle(i)) * r * R] as const;
  const [lo, hi] = scale.range;
  const step = scale.value === 'percentile' ? 25 : scale.value === 'percent_reference' ? 25 : 1;
  const rings: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) rings.push(v);
  const ring = (v: number) =>
    axes
      .map((_, i) =>
        pt(i, radius(v, scale.value))
          .map((x) => x.toFixed(1))
          .join(','),
      )
      .join(' ');
  /** Outline segments between consecutive axes that both have a value (gaps break the line). */
  const segments = (vals: (number | null)[]) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (n < 3 && j === 0) continue;
      const a = vals[i];
      const b = vals[j];
      if (a == null || b == null) continue;
      const [x1, y1] = pt(i, radius(a, scale.value));
      const [x2, y2] = pt(j, radius(b, scale.value));
      out.push(`M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`);
    }
    return out.join(' ');
  };
  const full = (vals: (number | null)[]) =>
    vals.every((v) => v != null)
      ? vals
          .map((v, i) =>
            pt(i, radius(v!, scale.value))
              .map((x) => x.toFixed(1))
              .join(','),
          )
          .join(' ')
      : null;
  const missingEverywhere = (i: number) => layers.every((l) => l.values[i] == null);
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        viewBox={`-80 20 ${S + 160} ${S - 40}`}
        role="img"
        aria-labelledby={`${uid}-t ${uid}-d`}
        className="h-auto w-full max-w-lg"
      >
        <title id={`${uid}-t`}>{title}</title>
        <desc id={`${uid}-d`}>{description}</desc>
        {rings.map((v) => (
          <polygon
            key={v}
            points={ring(v)}
            fill="none"
            className={v === scale.neutral ? 'stroke-muted' : 'stroke-border'}
            strokeWidth={v === scale.neutral ? 2 : 1}
          />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1);
          const [lx, ly] = pt(i, 1.18);
          const anchor = Math.abs(lx - C) < 8 ? 'middle' : lx > C ? 'start' : 'end';
          return (
            <g key={a}>
              <line x1={C} y1={C} x2={x} y2={y} className="stroke-border" />
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                className="fill-text text-[11px]"
              >
                {a}
              </text>
              {missingEverywhere(i) ? (
                <text
                  x={lx}
                  y={ly + 13}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className="fill-muted text-[10px]"
                >
                  sin dato
                </text>
              ) : null}
            </g>
          );
        })}
        <text
          x={C - 6}
          y={pt(0, radius(scale.neutral, scale.value))[1] - 4}
          textAnchor="end"
          className="fill-muted text-[10px]"
        >
          {neutralLabel}
        </text>
        {layers.map((l) => {
          const poly = full(l.values);
          const current = l.variant === 'current';
          return (
            <g key={l.label} className={current ? 'text-accent' : 'text-muted'}>
              {poly && current ? (
                <polygon points={poly} className="fill-current" fillOpacity={0.12} stroke="none" />
              ) : null}
              <path
                d={segments(l.values)}
                fill="none"
                className="stroke-current"
                strokeWidth={2}
                strokeDasharray={current ? undefined : '6 4'}
                strokeLinejoin="round"
              />
              {l.values.map((v, i) => {
                if (v == null) return null;
                const [x, y] = pt(i, radius(v, scale.value));
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={11} fill="transparent">
                      <title>{`${l.label} · ${axes[i]}: ${fmt(v)}`}</title>
                    </circle>
                    <circle
                      cx={x}
                      cy={y}
                      r={4}
                      className="fill-current stroke-bg"
                      strokeWidth={2}
                      pointerEvents="none"
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap justify-center gap-4 text-xs text-muted">
        {layers.map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <svg
              width="24"
              height="8"
              aria-hidden="true"
              className={l.variant === 'current' ? 'text-accent' : 'text-muted'}
            >
              <line
                x1="0"
                y1="4"
                x2="24"
                y2="4"
                className="stroke-current"
                strokeWidth={2}
                strokeDasharray={l.variant === 'current' ? undefined : '6 4'}
              />
            </svg>
            {l.label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <svg width="24" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="24" y2="4" className="stroke-muted" strokeWidth={1.5} />
          </svg>
          {neutralLabel}
        </span>
      </figcaption>
    </figure>
  );
}
