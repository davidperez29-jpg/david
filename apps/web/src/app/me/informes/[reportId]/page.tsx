import Link from 'next/link';
import { getClientReportView } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { ReportView } from '@/components/reports/report-view';
import { requireClientUser } from '@/server/session';

/** A report the trainer shared, in plain language, with its PDF. */
export default async function MyReport({ params }: { params: Promise<{ reportId: string }> }) {
  const ctx = await requireClientUser();
  const { reportId } = await params;
  const r = await getClientReportView(ctx, reportId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  return (
    <div className="flex flex-col gap-4">
      <Link href="/me/progreso" className="text-sm text-muted hover:underline">
        ← Tu progreso
      </Link>
      <a
        href={`/api/v1/reports/${r.id}/client-view/download`}
        className="inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-4 font-medium text-accent-contrast"
      >
        Descargar PDF
      </a>
      <ReportView report={r.report} />
    </div>
  );
}
