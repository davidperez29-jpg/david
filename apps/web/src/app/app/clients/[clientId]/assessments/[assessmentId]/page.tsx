import Link from 'next/link';
import { getAssessment, getClient } from '@tp/application';
import { DomainError, STOP_SYMPTOMS } from '@tp/domain';
import { notFound } from 'next/navigation';
import { ChangeLine } from '@/components/assessment/verdict';
import { Identifiers } from '@/components/science/evidence';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDate, formatValue, label } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import {
  AssessmentStatusActions,
  DeleteResultButton,
  RecordResultForm,
} from '../../../../assessments/forms';

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ clientId: string; assessmentId: string }>;
}) {
  const ctx = await requireStaff();
  const { clientId, assessmentId } = await params;
  const [a, client] = await Promise.all([
    getAssessment(ctx, assessmentId),
    getClient(ctx, clientId),
  ]).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  if (a.clientId !== clientId) notFound();
  const editable = a.status !== 'cancelled';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/app/clients/${clientId}?tab=evaluacion`}
          className="text-sm text-muted hover:underline"
        >
          ← {client.firstName} {client.lastName}
        </Link>
        <h1 className="text-2xl font-semibold">Evaluación del {formatDate(a.assessedOn)}</h1>
        {a.battery ? <Badge>{a.battery}</Badge> : null}
        {a.context ? <span className="text-sm text-muted">{a.context}</span> : null}
      </div>
      <AssessmentStatusActions id={a.id} status={a.status} />

      {a.flags.length ? (
        <div role="alert" className="rounded-md border border-danger p-3 text-sm">
          <p className="font-semibold text-danger">{a.flags[0]!.message}</p>
          <ul className="mt-1 list-inside list-disc">
            {a.flags.map((f, i) => (
              <li key={i}>
                {f.test}: {f.criterion}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">Es un criterio de cribado, no un diagnóstico.</p>
        </div>
      ) : null}

      <details className="rounded-md border border-warn p-3 text-sm">
        <summary className="cursor-pointer font-medium">Detener el test si aparece…</summary>
        <ul className="mt-2 list-inside list-disc">
          {STOP_SYMPTOMS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="mt-1">
          Marca el intento como no válido y deriva: requiere valoración por profesional sanitario.
        </p>
      </details>

      <Card title="Resultados">
        {a.results.length === 0 ? (
          <EmptyState>Sin resultados todavía.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {a.results.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.test.name}</span>
                  {r.side !== 'both' ? <Badge>{label('side', r.side)}</Badge> : null}
                  <span className="text-lg font-semibold tabular-nums">
                    {formatValue(r.value)} {r.test.unit}
                  </span>
                  {r.test.isEstimate ? <Badge tone="warn">Estimación</Badge> : null}
                  {!r.valid ? <Badge tone="danger">No válido</Badge> : null}
                  <span className="text-xs text-muted">
                    {r.test.aggregation} · intentos {(r.attempts as number[]).join(' / ')}
                    {r.cvIntraPercent != null ? ` · CV intra ${r.cvIntraPercent} %` : ''}
                    {r.measurementMethod ? ` · ${r.measurementMethod}` : ''}
                  </span>
                  {editable ? <DeleteResultButton id={r.id} /> : null}
                </div>
                {r.change ? (
                  <div className="text-xs">
                    <span className="text-muted">
                      Respecto al {formatDate(r.change.previousOn)}:{' '}
                    </span>
                    {r.change.comparable ? (
                      <ChangeLine change={r.change} unit={r.test.unit} />
                    ) : (
                      <span className="text-warn">{r.change.note}</span>
                    )}
                  </div>
                ) : null}
                {r.references.map((c) => (
                  <p key={c.referenceId} className="text-xs">
                    {c.applicable ? (
                      <span>
                        {c.summary}
                        {c.zScore != null ? ` · z = ${c.zScore}` : ''}
                        {c.band ? ` · ${c.band}` : ''}
                      </span>
                    ) : (
                      <span className="text-muted">
                        Referencia no comparable ({c.population}): {c.reasons.join('; ')}.
                      </span>
                    )}{' '}
                    <span className="text-muted">
                      {c.source} <Identifiers doi={c.doi} pmid={c.pmid} />
                    </span>
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {a.derived.length ? (
        <Card title="Métricas derivadas">
          <ul className="flex flex-col gap-2 text-sm">
            {a.derived.map((d) => (
              <li key={d.id}>
                <span className="font-medium">{d.name}:</span>{' '}
                <span className="tabular-nums">
                  {formatValue(d.value)} {d.unit}
                </span>
                {d.isEstimate ? <Badge tone="warn">Estimación</Badge> : null}
                <p className="text-xs text-muted">{d.formula}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {editable ? (
        <Card title="Registrar">
          <ul className="flex flex-col gap-4">
            {a.tests.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-1 border-b border-border pb-4 last:border-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  {t.recorded ? <Badge tone="ok">Registrado</Badge> : null}
                  <span className="text-xs text-muted">Se usa el {t.aggregation}.</span>
                </div>
                {t.protocol ? (
                  <details className="text-xs text-muted">
                    <summary className="cursor-pointer">Protocolo</summary>
                    <p className="whitespace-pre-line">{t.protocol}</p>
                  </details>
                ) : null}
                <RecordResultForm assessmentId={a.id} test={t} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
