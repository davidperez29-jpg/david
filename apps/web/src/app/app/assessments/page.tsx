import Link from 'next/link';
import { listAssessmentTests, listBatteries } from '@tp/application';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { label, LABELS } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import { NewTestForm } from './forms';

export default async function AssessmentCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireStaff();
  const { q } = await searchParams;
  const [tests, batteries] = await Promise.all([
    listAssessmentTests(ctx, { q }),
    listBatteries(ctx),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Evaluación</h1>
        <p className="text-sm text-muted">
          Cada test indica su protocolo, su fiabilidad (error de medida) y sus valores de referencia
          con la población estudiada. Sin fiabilidad aplicable no se emite veredicto de cambio; sin
          referencia aplicable no hay comparación con normas.
        </p>
      </div>

      <Card title="Baterías por objetivo">
        {batteries.length === 0 ? (
          <EmptyState>No hay baterías.</EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {batteries.map((b) => (
              <li key={b.id} className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{b.name}</span>
                  {b.isGlobal ? <Badge tone="accent">Global</Badge> : null}
                </div>
                {b.description ? <p className="text-xs text-muted">{b.description}</p> : null}
                <p className="mt-1 text-xs">
                  {b.tests.map((t) => (t.isCore ? t.name : `${t.name} (opcional)`)).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <form className="flex gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar test (sin importar tildes)"
          aria-label="Buscar test"
          className="h-9 min-w-56 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
        />
        <button className="h-9 rounded-md border border-border bg-bg px-4 text-sm">Buscar</button>
      </form>

      {Object.keys(LABELS.testCategory).map((cat) => {
        const list = tests.filter((t) => t.category === cat);
        if (!list.length) return null;
        return (
          <Card key={cat} title={label('testCategory', cat)}>
            <ul className="divide-y divide-border">
              {list.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link
                    href={`/app/assessments/tests/${t.id}`}
                    className="font-medium hover:underline"
                  >
                    {t.name}
                  </Link>
                  <span className="flex flex-wrap items-center gap-1 text-xs text-muted">
                    <span>{t.unit}</span>
                    {t.isEstimate ? <Badge tone="warn">Estimación</Badge> : null}
                    <Badge tone={t.reliability ? 'ok' : 'neutral'}>
                      {t.reliability
                        ? `Fiabilidad (${t.reliability})`
                        : 'Error de medida desconocido'}
                    </Badge>
                    <Badge tone={t.references ? 'ok' : 'neutral'}>
                      {t.references ? `Referencias (${t.references})` : 'Referencia insuficiente'}
                    </Badge>
                    {t.isGlobal ? null : <Badge tone="accent">Propio</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      <Card title="Nuevo test de la organización">
        <NewTestForm />
      </Card>
    </div>
  );
}
