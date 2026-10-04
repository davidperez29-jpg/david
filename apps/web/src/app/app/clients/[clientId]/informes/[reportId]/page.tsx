import Link from 'next/link';
import { getClientReport } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { ReportView } from '@/components/reports/report-view';
import { Card } from '@/components/ui/card';
import { formatDateTime } from '@/lib/labels';
import { requireStaff } from '@/server/session';

export default async function ReportPage({
  params,
}: {
  params: Promise<{ clientId: string; reportId: string }>;
}) {
  const ctx = await requireStaff();
  const { clientId, reportId } = await params;
  const r = await getClientReport(ctx, reportId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  if (r.clientId !== clientId) notFound();
  const dl = (f: string) => `/api/v1/reports/${r.id}/download?format=${f}`;
  const btn =
    'inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-surface';
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <Link
        href={`/app/clients/${clientId}?tab=informes`}
        className="text-sm text-muted hover:underline"
      >
        ← Informes del cliente
      </Link>
      <Card>
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
          El informe se congela al generarlo: cualquier formato muestra exactamente los mismos datos
          aunque después cambien. Las descargas quedan registradas.
        </p>
      </Card>
      <Card>
        <ReportView report={r.report} />
      </Card>
    </div>
  );
}
