import Link from 'next/link';
import { getClientReport } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { ReportView } from '@/components/reports/report-view';
import { Card } from '@/components/ui/card';
import { formatDateTime } from '@/lib/labels';
import { requireStaff } from '@/server/session';

/** Rendimiento (group report): frozen, staff only, PDF / Excel / CSV. */
export default async function GroupReportPage({
  params,
}: {
  params: Promise<{ groupId: string; reportId: string }>;
}) {
  const ctx = await requireStaff();
  const { groupId, reportId } = await params;
  const r = await getClientReport(ctx, reportId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  if (r.groupId !== groupId) notFound();
  const dl = (f: string) => `/api/v1/reports/${r.id}/download?format=${f}`;
  const btn =
    'inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-surface';
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <Link href={`/app/groups/${groupId}`} className="text-sm text-muted hover:underline">
        ← Grupo
      </Link>
      <Card title="Informe de rendimiento">
        <div className="flex flex-wrap items-center gap-2">
          <a className={`${btn} border-accent bg-accent text-accent-contrast`} href={dl('pdf')}>
            Descargar PDF
          </a>
          <a className={btn} href={dl('xlsx')}>
            Excel
          </a>
          <a className={btn} href={dl('csv')}>
            CSV
          </a>
          <span className="text-xs text-muted">
            Generado {formatDateTime(r.createdAt)} · huella <code>{r.hash?.slice(0, 12)}</code>
            {r.intact ? ' · íntegro' : ' · ¡la huella no coincide!'}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">
          Solo para el equipo técnico: ningún cliente ve los datos de los demás.
        </p>
      </Card>
      <Card>
        <ReportView report={r.report} />
      </Card>
    </div>
  );
}
