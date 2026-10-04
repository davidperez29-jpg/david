import Link from 'next/link';
import { getImportJob } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { ImportDecision } from '@/components/reports/actions';
import { Badge, Card } from '@/components/ui/card';
import { formatDateTime } from '@/lib/labels';
import { requireStaff } from '@/server/session';

const ROW: Record<string, [string, 'ok' | 'danger' | 'accent' | 'neutral']> = {
  valid: ['Válida', 'accent'],
  invalid: ['Con errores', 'danger'],
  imported: ['Importada', 'ok'],
  skipped: ['Omitida', 'neutral'],
};
const show = (v: unknown) =>
  v == null || v === '' ? '' : Array.isArray(v) ? v.join(' | ') : String(v);

export default async function ImportJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const ctx = await requireStaff();
  const { jobId } = await params;
  const job = await getImportJob(ctx, jobId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  const invalid = job.rows.filter((r) => r.status === 'invalid').length;
  const valid = job.rows.filter((r) => r.status === 'valid').length;
  return (
    <div className="flex flex-col gap-4">
      <Link href="/app/informes" className="text-sm text-muted hover:underline">
        ← Informes
      </Link>
      <h1 className="text-2xl font-semibold">Importación · {job.fileName}</h1>
      <Card title="2. Revisa y confirma">
        <p className="text-sm">
          {job.total} filas · <strong>{valid} válidas</strong> ·{' '}
          <span className={invalid ? 'text-danger' : ''}>{invalid} con errores</span> · creada{' '}
          {formatDateTime(job.createdAt)}
        </p>
        {job.status === 'pending' ? (
          <div className="mt-3">
            <ImportDecision jobId={job.id} valid={valid} />
            <p className="mt-2 text-xs text-muted">
              Solo se importan las filas válidas. Corrige las demás en tu archivo y vuelve a
              subirlo.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Estado:{' '}
            {job.status === 'succeeded'
              ? 'importada'
              : job.status === 'cancelled'
                ? 'cancelada'
                : job.status}
            .
          </p>
        )}
      </Card>
      <Card title="Filas">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 pr-2">Fila</th>
                <th className="pr-2">Estado</th>
                {job.columns.map((c) => (
                  <th key={c.key} className="pr-2">
                    {c.header}
                  </th>
                ))}
                <th>Errores</th>
              </tr>
            </thead>
            <tbody>
              {job.rows.map((r) => (
                <tr key={r.rowNumber} className="border-t border-border align-top">
                  <td className="py-1 pr-2 tabular-nums">{r.rowNumber}</td>
                  <td className="pr-2">
                    <Badge tone={ROW[r.status]?.[1] ?? 'neutral'}>
                      {ROW[r.status]?.[0] ?? r.status}
                    </Badge>
                  </td>
                  {job.columns.map((c) => (
                    <td
                      key={c.key}
                      className={`pr-2 ${r.errors[c.key] ? 'bg-danger/10 text-danger' : ''}`}
                    >
                      {show(
                        (r.data.raw as Record<string, unknown> | undefined)?.[c.key] ??
                          r.data[c.key],
                      )}
                    </td>
                  ))}
                  <td className="text-xs text-danger">
                    {Object.entries(r.errors).map(([f, msgs]) => (
                      <div key={f}>
                        {job.columns.find((c) => c.key === f)?.header ?? f}: {msgs.join(' ')}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
