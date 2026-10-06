import Link from 'next/link';
import { clientComparison, getClient } from '@tp/application';
import { DomainError, type Scale } from '@tp/domain';
import { notFound } from 'next/navigation';
import { RadarChart } from '@/components/assessment/radar';
import { VerdictBadge } from '@/components/assessment/verdict';
import { Card, EmptyState } from '@/components/ui/card';
import { formatDate, formatValue } from '@/lib/labels';
import { requireStaff } from '@/server/session';

type SP = { a?: string; b?: string; scale?: string; dims?: string | string[] };

const sel = 'h-10 rounded-md border border-border bg-bg px-2 text-sm text-text';
const arrow = (d: string) => (d === 'higher' ? '↑' : d === 'lower' ? '↓' : '');
const signed = (v: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v);
const scoreText = (v: number | null, scale: Scale) =>
  v == null
    ? '—'
    : scale === 'percentile'
      ? `P${Math.round(v)}`
      : scale === 'percent_reference'
        ? `${formatValue(Math.round(v))} %`
        : signed(Math.round(v * 100) / 100);

/**
 * Comparativa (restructure phase 5): CLIENTE · EVALUACIÓN A · EVALUACIÓN B · ESCALA. The radar
 * puts dimensions on one standardized scale; the tables give every real value, the change and
 * whether it exceeds the measurement error. Nothing here is a diagnosis.
 */
export default async function ComparisonPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<SP>;
}) {
  const ctx = await requireStaff();
  const { clientId } = await params;
  const sp = await searchParams;
  const dims = Array.isArray(sp.dims) ? sp.dims.join(',') : sp.dims;
  const [client, c] = await Promise.all([
    getClient(ctx, clientId),
    clientComparison(ctx, clientId, { a: sp.a, b: sp.b, scale: sp.scale, dims }),
  ]).catch((e) => {
    if (e instanceof DomainError && (e.code === 'not_found' || e.code === 'validation')) notFound();
    throw e;
  });
  const name = `${client.firstName} ${client.lastName}`;
  const withData = c.assessments.filter((x) => x.hasResults);
  const label = (x: { assessedOn: string; context: string | null }) =>
    `${formatDate(x.assessedOn)}${x.context ? ` · ${x.context}` : ''}`;
  const scale = c.scale?.value ?? 'z_group';
  const radarDims = c.dimensions.filter((d) => d.scoreA != null || d.scoreB != null);
  const layers = [
    ...(c.a && radarDims.some((d) => d.scoreA != null)
      ? [
          {
            label: `A · ${formatDate(c.a.assessedOn)}`,
            values: radarDims.map((d) => d.scoreA),
            variant: 'previous' as const,
          },
        ]
      : []),
    {
      label: `B · ${formatDate(c.b?.assessedOn ?? null)}`,
      values: radarDims.map((d) => d.scoreB),
      variant: 'current' as const,
    },
  ];
  const neutralLabel =
    c.basis?.kind === 'group'
      ? scale === 'percentile'
        ? 'P50 del grupo'
        : 'Media del grupo'
      : scale === 'percent_reference'
        ? '100 % de la referencia'
        : 'Referencia';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/app/clients/${clientId}?tab=evaluacion`}
          className="text-sm text-muted hover:underline"
        >
          ← {name}
        </Link>
        <h1 className="text-2xl font-semibold">Comparativa y radar</h1>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2" aria-label="Elegir comparación">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Evaluación A</span>
          <select name="a" defaultValue={c.a?.id ?? ''} className={sel}>
            {withData.map((x) => (
              <option key={x.id} value={x.id}>
                {label(x)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Evaluación B</span>
          <select name="b" defaultValue={c.b?.id ?? ''} className={sel}>
            {withData.map((x) => (
              <option key={x.id} value={x.id}>
                {label(x)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Escala</span>
          <select name="scale" defaultValue={sp.scale ?? 'auto'} className={sel}>
            <option value="auto">Automática</option>
            {c.scales.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <details className="relative">
          <summary className="flex h-10 cursor-pointer items-center rounded-md border border-border px-3 text-sm">
            Dimensiones ({c.dimensions.length})
          </summary>
          <fieldset className="absolute z-10 mt-1 grid w-72 gap-1 rounded-md border border-border bg-bg p-3 shadow">
            <legend className="sr-only">Dimensiones del radar</legend>
            {c.allDimensions.map((d) => (
              <label key={d.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="dims"
                  value={d.key}
                  defaultChecked={c.dimensions.some((x) => x.key === d.key)}
                />
                {d.name}
              </label>
            ))}
          </fieldset>
        </details>
        <button className="h-10 rounded-md bg-accent px-4 text-sm font-medium text-accent-contrast hover:bg-accent-hover">
          Comparar
        </button>
      </form>

      {c.notes.map((n) => (
        <p key={n} role="note" className="rounded-md border border-warn p-3 text-sm">
          {n}
        </p>
      ))}

      {!c.b ? (
        <EmptyState>Sin evaluaciones con resultados.</EmptyState>
      ) : (
        <>
          <Card title={`${c.scale!.label} · ${c.basis!.label}`}>
            {radarDims.length >= 3 ? (
              <RadarChart
                axes={radarDims.map((d) => d.name)}
                layers={layers}
                scale={{ value: scale, neutral: c.scale!.neutral, range: c.scale!.range }}
                neutralLabel={neutralLabel}
                title={`Radar de ${name}`}
                description={`${c.scale!.label}. ${radarDims
                  .map(
                    (d) =>
                      `${d.name}: A ${scoreText(d.scoreA, scale)}, B ${scoreText(d.scoreB, scale)}`,
                  )
                  .join('; ')}. Hacia fuera es mejor.`}
              />
            ) : (
              <p className="text-sm text-muted">
                Hacen falta al menos 3 dimensiones con datos para dibujar el radar; la tabla muestra
                lo que hay.
              </p>
            )}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Puntuación por dimensión</caption>
                <thead className="bg-surface text-left text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-2 py-1 font-medium">
                      Dimensión
                    </th>
                    <th scope="col" className="px-2 py-1 font-medium">
                      A
                    </th>
                    <th scope="col" className="px-2 py-1 font-medium">
                      B
                    </th>
                    <th scope="col" className="px-2 py-1 font-medium">
                      Tests con dato en B
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.dimensions.map((d) => (
                    <tr key={d.key} className="border-t border-border">
                      <th scope="row" className="px-2 py-1 text-left font-medium">
                        {d.name}
                      </th>
                      <td className="px-2 py-1 tabular-nums">{scoreText(d.scoreA, scale)}</td>
                      <td className="px-2 py-1 tabular-nums">{scoreText(d.scoreB, scale)}</td>
                      <td className="px-2 py-1 text-xs text-muted">
                        {d.usedB.length
                          ? d.usedB
                              .map((s) => c.items.find((i) => i.slug === s)?.name ?? s)
                              .join(', ')
                          : 'sin dato'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">
              Cada test se pasa a la misma escala con su sentido corregido (hacia fuera siempre es
              mejor) y cada dimensión es la media ponderada de sus tests con dato. A y B se comparan
              con la misma base, así que el cambio es del cliente, no de la base. Sin dato = hueco,
              nunca cero. En el radar la Z se recorta a ±3; el valor real está en la tabla.
            </p>
          </Card>

          <Card title="Test a test">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Valores, cambio y cambio real por test</caption>
                <thead className="bg-surface text-left text-xs text-muted">
                  <tr>
                    {['Test', 'A', 'B', 'Cambio', '¿Cambio real?', 'Puntuación A → B', 'Base'].map(
                      (h) => (
                        <th key={h} scope="col" className="px-2 py-1 font-medium">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {c.items.map((i) => (
                    <tr key={i.slug} className="border-t border-border align-top">
                      <th scope="row" className="px-2 py-1 text-left font-medium">
                        {i.name}{' '}
                        <span className="text-xs font-normal text-muted">
                          ({i.unit}) {arrow(i.direction)}
                        </span>
                      </th>
                      <td className="px-2 py-1 tabular-nums">{formatValue(i.rawA)}</td>
                      <td className="px-2 py-1 tabular-nums">{formatValue(i.rawB)}</td>
                      <td className="px-2 py-1 whitespace-nowrap tabular-nums">
                        {i.change
                          ? `${signed(i.change.delta)} ${i.unit}${i.change.deltaPercent != null ? ` (${signed(i.change.deltaPercent)} %)` : ''}`
                          : '—'}
                      </td>
                      <td className="px-2 py-1">
                        {i.change ? <VerdictBadge verdict={i.change.verdict} /> : null}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap tabular-nums">
                        {scoreText(i.scoreA, scale)} → {scoreText(i.scoreB, scale)}
                      </td>
                      <td className="max-w-56 px-2 py-1 text-xs text-muted">
                        {i.basis ?? (i.direction === 'target_range' ? 'Descriptivo' : 'Sin base')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">
              «¿Cambio real?» compara la diferencia con el error de medida del test (MDC); si no se
              conoce, se muestra la diferencia sin veredicto. Los tests unilaterales usan la media
              de los dos lados; la asimetría está en cada evaluación.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
