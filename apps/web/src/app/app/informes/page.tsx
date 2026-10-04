import Link from 'next/link';
import { listClients, listImportJobs } from '@tp/application';
import { ExportForm } from '@/components/reports/actions';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDateTime } from '@/lib/labels';
import { requireStaff } from '@/server/session';

const ENTITY: Record<string, string> = {
  clients: 'Clientes',
  exercises: 'Ejercicios',
  assessments: 'Evaluaciones',
  references: 'Referencias',
};
const JOB_STATUS: Record<string, string> = {
  pending: 'Pendiente de confirmar',
  succeeded: 'Importada',
  cancelled: 'Cancelada',
  failed: 'Fallida',
  running: 'En curso',
};

export default async function ReportsPage() {
  const ctx = await requireStaff();
  const [{ items }, jobs] = await Promise.all([
    listClients(ctx, { limit: 100 }),
    listImportJobs(ctx).catch(() => []),
  ]);
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Informes, exportación e importación</h1>
      <Card title="Informe de un cliente">
        <p className="text-sm">
          Se genera desde la ficha del cliente, pestaña <strong>Informes</strong>: 11 apartados
          (datos, objetivos, evaluación, resultados, evolución, interpretación, planificación,
          adherencia, feedback, recomendaciones y próxima reevaluación) en pantalla, PDF, Excel y
          CSV.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {items.slice(0, 12).map((c) => (
            <li key={c.id}>
              <Link href={`/app/clients/${c.id}?tab=informes`} className="text-accent underline">
                {c.firstName} {c.lastName}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Exportar datos (Excel o CSV)">
        <ExportForm
          clients={items.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
        />
      </Card>
      <Card
        title="Importar datos"
        actions={
          <Link
            href="/app/informes/importar"
            className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-contrast"
          >
            Nueva importación
          </Link>
        }
      >
        <p className="mb-2 text-sm text-muted">
          Clientes, ejercicios, evaluaciones y referencias desde CSV o Excel. Se validan todas las
          filas y ves los errores antes de importar nada.
        </p>
        {jobs.length === 0 ? (
          <EmptyState>Sin importaciones todavía.</EmptyState>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-2 py-2">
                <Link
                  href={`/app/informes/importar/${j.id}`}
                  className="font-medium hover:underline"
                >
                  {ENTITY[j.entity] ?? j.entity} · {j.fileName}
                </Link>
                <Badge
                  tone={
                    j.status === 'succeeded' ? 'ok' : j.status === 'pending' ? 'accent' : 'neutral'
                  }
                >
                  {JOB_STATUS[j.status] ?? j.status}
                </Badge>
                <span className="text-xs text-muted">
                  {j.valid ?? 0} de {j.total ?? 0} filas · {formatDateTime(j.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
