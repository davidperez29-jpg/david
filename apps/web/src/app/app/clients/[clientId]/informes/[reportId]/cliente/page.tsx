import Link from 'next/link';
import { getClientReportView } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { ReportView } from '@/components/reports/report-view';
import { Card } from '@/components/ui/card';
import { requireStaff } from '@/server/session';

/** Preview of what the client sees once the report is shared. */
export default async function ClientVersionPreview({
  params,
}: {
  params: Promise<{ clientId: string; reportId: string }>;
}) {
  const ctx = await requireStaff();
  const { clientId, reportId } = await params;
  const r = await getClientReportView(ctx, reportId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  if (r.clientId !== clientId) notFound();
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Link
        href={`/app/clients/${clientId}/informes/${reportId}`}
        className="text-sm text-muted hover:underline"
      >
        ← Informe completo
      </Link>
      <p className="text-sm">
        {r.sharedAt
          ? 'Así lo ve el cliente en su app.'
          : 'Vista previa: el cliente aún no lo ve. Compártelo desde el informe completo.'}
      </p>
      <Card>
        <ReportView report={r.report} />
      </Card>
    </div>
  );
}
