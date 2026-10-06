import type { ClientReport, ReportBlock, Scale } from '@tp/domain';
import { RadarChart } from '@/components/assessment/radar';

const fmtScore = (v: number | null) =>
  v == null ? 'sin dato' : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(v);

function Radar({ b }: { b: Extract<ReportBlock, { kind: 'radar' }> }) {
  const scale: Scale =
    b.range[1] === 100 ? 'percentile' : b.range[1] === 150 ? 'percent_reference' : 'z_group';
  return (
    <div className="my-2">
      <p className="text-xs font-medium">
        {b.title} · <span className="text-muted">{b.scaleLabel}</span>
      </p>
      <RadarChart
        axes={b.axes}
        layers={b.layers}
        scale={{ value: scale, neutral: b.neutral, range: b.range }}
        neutralLabel={b.neutralLabel}
        title={b.title}
        description={b.axes
          .map(
            (a, i) =>
              `${a}: ${b.layers.map((l) => `${l.label} ${fmtScore(l.values[i] ?? null)}`).join(', ')}`,
          )
          .join('; ')}
      />
    </div>
  );
}

const fmt = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

function Chart({ b }: { b: Extract<ReportBlock, { kind: 'chart' }> }) {
  const W = 360;
  const H = 120;
  const P = 32;
  const vs = b.points.map((p) => p.value);
  let min = Math.min(...vs);
  let max = Math.max(...vs);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.1;
  min -= pad;
  max += pad;
  const x = (i: number) =>
    P + (b.points.length === 1 ? (W - P) / 2 : (i / (b.points.length - 1)) * (W - P - 8));
  const y = (v: number) => 8 + (H - 24) * (1 - (v - min) / (max - min));
  return (
    <figure className="my-2">
      <figcaption className="text-xs font-medium">
        {b.title} ({b.unit})
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-md"
        role="img"
        aria-label={`${b.title}: ${b.points.map((p) => `${fmt(p.date)} ${p.value.toLocaleString('es-ES')} ${b.unit}`).join(', ')}`}
      >
        <line x1={P} y1={8} x2={P} y2={H - 16} className="stroke-border" />
        <line x1={P} y1={H - 16} x2={W} y2={H - 16} className="stroke-border" />
        <text x={P - 4} y={12} textAnchor="end" className="fill-muted text-[9px]">
          {(Math.round(max * 10) / 10).toLocaleString('es-ES')}
        </text>
        <text x={P - 4} y={H - 16} textAnchor="end" className="fill-muted text-[9px]">
          {(Math.round(min * 10) / 10).toLocaleString('es-ES')}
        </text>
        <polyline
          fill="none"
          strokeWidth={2}
          className="stroke-accent"
          points={b.points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
        />
        {b.points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r={3} className="fill-accent" />
            <text x={x(i)} y={H - 4} textAnchor="middle" className="fill-muted text-[9px]">
              {fmt(p.date)}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

function Block({ b }: { b: ReportBlock }) {
  if (b.kind === 'text')
    return (
      <p
        className={`text-sm ${b.tone === 'muted' ? 'text-muted' : b.tone === 'warn' ? 'rounded-md border border-warn px-2 py-1' : ''}`}
      >
        {b.text}
      </p>
    );
  if (b.kind === 'list')
    return (
      <ul className="list-disc pl-5 text-sm">
        {b.items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    );
  if (b.kind === 'chart') return <Chart b={b} />;
  if (b.kind === 'radar') return <Radar b={b} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            {b.columns.map((c) => (
              <th key={c} className="py-1 pr-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.rows.map((r, i) => (
            <tr key={i} className="border-t border-border align-top">
              {r.map((c, j) => (
                <td key={j} className="py-1 pr-2">
                  {c == null ? '—' : typeof c === 'number' ? c.toLocaleString('es-ES') : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Same blocks as the PDF, XLSX and CSV: one report model for every format. */
export function ReportView({ report }: { report: ClientReport }) {
  return (
    <article className="flex flex-col gap-4">
      <header>
        <h2 className="text-xl font-semibold">{report.title}</h2>
        <p className="text-sm text-muted">{report.subtitle}</p>
      </header>
      {report.sections.map((s) => (
        <section
          key={s.key}
          aria-labelledby={`sec-${s.key}`}
          className="flex flex-col gap-2 break-inside-avoid"
        >
          <h3
            id={`sec-${s.key}`}
            className="border-b border-border pb-1 text-base font-semibold text-accent"
          >
            {s.number}. {s.title}
          </h3>
          {s.blocks.some((b) => b.kind === 'chart') ? (
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {s.blocks.map((b, i) => (b.kind === 'chart' ? <Chart key={i} b={b} /> : null))}
            </div>
          ) : null}
          {s.blocks.map((b, i) => (b.kind === 'chart' ? null : <Block key={i} b={b} />))}
        </section>
      ))}
      <footer className="text-xs text-muted">
        {report.footer.map((f) => (
          <p key={f}>{f}</p>
        ))}
      </footer>
    </article>
  );
}
