import Link from 'next/link';
import { groupReport, listGroupReports, type GroupReport } from '@tp/application';
import { BAND_LABELS, DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { AttemptsSheet } from '@/components/assessment/attempts-sheet';
import { GenerateGroupReportForm } from '@/components/reports/actions';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDate, formatValue } from '@/lib/labels';
import { requireStaff } from '@/server/session';

type Row = GroupReport['rows'][number];

const RULES: Record<string, string> = {
  best: 'mejor intento',
  mean: 'media de los intentos',
  mean_of_best_n: 'media de los mejores',
  last: 'último intento',
  median: 'mediana de los intentos',
  min: 'valor mínimo',
  max: 'valor máximo',
};
const arrow = (d: string) => (d === 'higher' ? '↑' : d === 'lower' ? '↓' : '');
const zText = (z: number | null) =>
  z == null ? '' : `${z > 0 ? '+' : ''}${formatValue(Math.round(z * 100) / 100)}`;

/** Cell tone: the band of Z (green / yellow / red, as the club sheet); asymmetry by its %. */
function tone(row: Row, i: number): string {
  if (row.kind === 'asymmetry') {
    const v = row.values[i];
    return v == null ? '' : v < 10 ? 'text-ok' : v < 15 ? 'text-warn' : 'text-danger';
  }
  const b = row.bands[i];
  return b === 'destacado' ? 'text-ok' : b === 'a_mejorar' ? 'text-danger' : b ? 'text-warn' : '';
}

export default async function GroupSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string; date: string }>;
  searchParams: Promise<{ vista?: string; test?: string }>;
}) {
  const ctx = await requireStaff();
  const { groupId, date } = await params;
  const sp = await searchParams;
  const r = await groupReport(ctx, groupId, { date }).catch((e) => {
    if (e instanceof DomainError && (e.code === 'not_found' || e.code === 'validation')) notFound();
    throw e;
  });
  const report = sp.vista === 'informe';
  const reports = report ? await listGroupReports(ctx, groupId) : [];
  const base = `/app/groups/${groupId}/${date}`;
  const tab = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm ${active ? 'bg-accent text-accent-contrast' : 'border border-border hover:bg-surface'}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/app/groups/${groupId}`} className="text-sm text-muted hover:underline">
          ← {r.group.name}
        </Link>
        <h1 className="text-2xl font-semibold">Evaluación del {formatDate(date)}</h1>
        <nav className="flex gap-2" aria-label="Vista">
          <Link href={base} className={tab(!report)} aria-current={!report ? 'page' : undefined}>
            Hoja de intentos
          </Link>
          <Link
            href={`${base}?vista=informe`}
            className={tab(report)}
            aria-current={report ? 'page' : undefined}
          >
            Informe grupal
          </Link>
        </nav>
      </div>
      {r.missing.length ? (
        <p className="text-sm text-muted">
          Sin evaluación ese día: {r.missing.join(', ')}. Vuelve a crear la evaluación de grupo en
          esa fecha para añadirlos.
        </p>
      ) : null}
      {r.members.length === 0 ? (
        <EmptyState>No hay evaluaciones del grupo en esta fecha.</EmptyState>
      ) : report ? (
        <Report r={r} reports={reports.filter((x) => x.parameters.date === date)} />
      ) : (
        <Sheet r={r} testId={sp.test} base={base} />
      )}
    </div>
  );
}

function Sheet({ r, testId, base }: { r: GroupReport; testId?: string; base: string }) {
  const t = r.tests.find((x) => x.id === testId) ?? r.tests[0];
  if (!t) return <EmptyState>Esta evaluación no tiene tests.</EmptyState>;
  const sides = t.sided ? (['right', 'left'] as const) : (['both'] as const);
  return (
    <Card title="Hoja de intentos">
      <nav aria-label="Tests" className="mb-3 flex flex-wrap gap-1">
        {r.tests.map((x) => {
          const done = r.members.filter((m) =>
            Object.keys(r.attempts[m.assessmentId] ?? {}).some((k) => k.startsWith(`${x.id}:`)),
          ).length;
          return (
            <Link
              key={x.id}
              href={`${base}?test=${x.id}`}
              aria-current={x.id === t.id ? 'page' : undefined}
              className={`rounded-full border px-3 py-1 text-xs ${x.id === t.id ? 'border-accent bg-accent text-accent-contrast' : 'border-border hover:bg-surface'}`}
            >
              {x.name}{' '}
              <span className={x.id === t.id ? '' : 'text-muted'}>
                {done}/{r.members.length}
              </span>
            </Link>
          );
        })}
      </nav>
      <AttemptsSheet
        key={t.id}
        caption={`${t.name}: intentos por jugador`}
        rule={`${t.name} (${t.unit}). Resultado: ${RULES[t.aggregation] ?? t.aggregation}. ${arrow(t.betterDirection) === '↓' ? 'Menos es mejor.' : arrow(t.betterDirection) === '↑' ? 'Más es mejor.' : 'Descriptivo.'}`}
        rows={r.members.flatMap((m, i) =>
          sides.map((side) => {
            const row = r.rows.find((x) => x.testId === t.id && x.side === side);
            const existing = r.attempts[m.assessmentId]?.[`${t.id}:${side}`] ?? null;
            return {
              key: `${m.assessmentId}:${side}`,
              label: m.name,
              sublabel: side === 'right' ? 'Derecha' : side === 'left' ? 'Izquierda' : null,
              assessmentId: m.assessmentId,
              testId: t.id,
              side,
              unit: t.unit,
              columns: t.defaultAttempts,
              existing,
              value: row?.values[i] != null ? formatValue(row.values[i]) : null,
              flag: row?.flags[i] ? 'Confirmar medición' : null,
            };
          }),
        )}
      />
    </Card>
  );
}

function Report({
  r,
  reports,
}: {
  r: GroupReport;
  reports: Awaited<ReturnType<typeof listGroupReports>>;
}) {
  const name = (i: number | null) => (i == null ? '—' : r.members[i]!.name);
  const compared = r.rows.filter((x) => x.direction !== 'target_range' && x.n > 0);
  return (
    <>
      <Card title="Informe de rendimiento (PDF, Excel, CSV)">
        <GenerateGroupReportForm
          groupId={r.group.id}
          date={r.date}
          members={r.members.map((m) => ({ id: m.clientId, name: m.name }))}
        />
        {reports.length ? (
          <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
            {reports.map((x) => (
              <li key={x.id}>
                <Link
                  href={`/app/groups/${r.group.id}/informes/${x.id}`}
                  className="text-accent hover:underline"
                >
                  Informe del {formatDate(x.parameters.date)}
                </Link>{' '}
                <span className="text-xs text-muted">{x.by ?? ''}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      {r.smallGroup ? (
        <p role="note" className="rounded-md border border-warn p-3 text-sm">
          Grupo pequeño ({r.members.length}): la media y la Z cambian mucho con una sola persona.
          Úsalas con cautela.
        </p>
      ) : null}
      <Card title="Resumen del grupo">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Resumen por prueba</caption>
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                {[
                  'Prueba',
                  'N',
                  'Media',
                  'Referencia',
                  'DT',
                  'Máximo',
                  'Mínimo',
                  'Mejor',
                  'Peor',
                ].map((h) => (
                  <th key={h} scope="col" className="px-2 py-1 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.rows.map((x) => (
                <tr key={x.key} className="border-t border-border align-top">
                  <th scope="row" className="px-2 py-1 text-left font-medium">
                    {x.name}{' '}
                    <span className="text-xs font-normal text-muted">
                      ({x.unit}) {arrow(x.direction)}
                    </span>
                    {x.isEstimate ? (
                      <span className="ml-1">
                        <Badge tone="warn">Estimación</Badge>
                      </span>
                    ) : null}
                    {x.definition ? (
                      <details className="text-xs font-normal text-muted">
                        <summary className="cursor-pointer">Cómo se calcula</summary>
                        {x.definition}
                      </details>
                    ) : null}
                  </th>
                  <td className="px-2 py-1 tabular-nums">{x.n}</td>
                  <td className="px-2 py-1 tabular-nums">{formatValue(x.mean)}</td>
                  <td className="max-w-64 px-2 py-1 text-xs">
                    {x.references.length ? (
                      <details>
                        <summary className="cursor-pointer">
                          {x.references[0]!.split(' (')[0]}
                        </summary>
                        <ul className="mt-1 flex flex-col gap-1">
                          {x.references.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1 tabular-nums">{formatValue(x.sd)}</td>
                  <td className="px-2 py-1 tabular-nums">{formatValue(x.max)}</td>
                  <td className="px-2 py-1 tabular-nums">{formatValue(x.min)}</td>
                  <td className="px-2 py-1">
                    {x.direction === 'target_range' ? (
                      <span className="text-xs text-muted">Descriptivo</span>
                    ) : (
                      name(x.best)
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {x.direction === 'target_range' ? '' : name(x.worst)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          DT: desviación típica muestral (n − 1). N: personas con un valor válido. Mejor y peor
          siguen el sentido de cada prueba (↑ más es mejor, ↓ menos es mejor); en las descriptivas
          no procede. Las referencias indican población, fuente, condición y limitaciones: solo
          orientan si la población se parece a la del grupo.
        </p>
      </Card>

      <Card title="Por persona · Z frente al grupo">
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm">
            <caption className="sr-only">Valor y Z de cada persona en cada prueba</caption>
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th scope="col" className="sticky left-0 bg-surface px-2 py-1 font-medium">
                  Persona
                </th>
                {compared.map((x) => (
                  <th key={x.key} scope="col" className="min-w-24 px-2 py-1 font-medium">
                    {x.name} {arrow(x.direction)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.members.map((m, i) => (
                <tr key={m.clientId} className="border-t border-border">
                  <th
                    scope="row"
                    className="sticky left-0 bg-bg px-2 py-1 text-left font-medium whitespace-nowrap"
                  >
                    <Link
                      href={`/app/clients/${m.clientId}/assessments/${m.assessmentId}`}
                      className="hover:underline"
                    >
                      {m.name}
                    </Link>
                  </th>
                  {compared.map((x) => {
                    const v = x.values[i];
                    const b = x.bands[i];
                    return (
                      <td key={x.key} className={`px-2 py-1 tabular-nums ${tone(x, i)}`}>
                        {v == null ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <>
                            {formatValue(v)}
                            {x.kind !== 'asymmetry' && x.z[i] != null ? (
                              <span className="block text-xs">
                                Z {zText(x.z[i]!)}
                                <span className="sr-only">, {b ? BAND_LABELS[b] : ''}</span>
                              </span>
                            ) : null}
                            {x.flags[i] ? (
                              <span className="block text-xs text-warn">Confirmar medición</span>
                            ) : null}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Z: distancia a la media del grupo en desviaciones típicas, con el signo corregido para que
          positivo sea siempre mejor. <span className="text-ok">Verde</span>: Z &gt; +1 (destacado)
          · <span className="text-warn">amarillo</span>: entre −1 y +1 (en la media) ·{' '}
          <span className="text-danger">rojo</span>: Z &lt; −1 (a mejorar). Asimetría: &lt; 10 %
          verde, 10–15 % naranja, ≥ 15 % rojo (orientativo, no predice lesiones). Compara dentro de
          este grupo, no con la población. «Confirmar medición»: valor fuera de los límites
          plausibles del test o muy alejado del resto; se conserva hasta que lo revises.
        </p>
      </Card>
    </>
  );
}
