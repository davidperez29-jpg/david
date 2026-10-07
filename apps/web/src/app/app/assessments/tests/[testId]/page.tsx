import Link from 'next/link';
import { getAssessmentTest } from '@tp/application';
import { evidenceCards } from '@tp/application';
import { SourceButton } from '@/components/science/source-button';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { Identifiers, PubMedAttribution } from '@/components/science/evidence';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { label } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import { DeleteReferenceButton, DeleteReliabilityButton, LocalReliabilityForm } from '../../forms';

const fmtValues = (v: Record<string, unknown>) =>
  Object.entries(v)
    .filter(([, x]) => x != null && x !== '')
    .map(([k, x]) => `${k}: ${String(x)}`)
    .join(' · ');

export default async function TestPage({ params }: { params: Promise<{ testId: string }> }) {
  const ctx = await requireStaff();
  const { testId } = await params;
  const t = await getAssessmentTest(ctx, testId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/app/assessments" className="text-sm text-muted hover:underline">
          ← Evaluación
        </Link>
        <h1 className="text-2xl font-semibold">{t.name}</h1>
        <Badge>{label('testCategory', t.category)}</Badge>
        {t.isEstimate ? <Badge tone="warn">Estimación</Badge> : null}
        {t.isGlobal ? <Badge tone="accent">Global (solo lectura)</Badge> : null}
      </div>
      <Card title="Ficha">
        <dl className="grid gap-2 text-sm sm:grid-cols-[12rem_1fr]">
          {(
            [
              ['Objetivo', t.purpose],
              ['Poblaciones', t.targetPopulations],
              ['Protocolo', t.protocol ? `${t.protocol} (versión ${t.protocolVersion})` : null],
              ['Material', t.equipment.join(', ') || null],
              ['Unidad', `${t.unit} · ${label('betterDirection', t.betterDirection)}`],
              ['Intentos', `${t.defaultAttempts} · se usa el ${t.aggregationLabel}`],
              ['Por lados', t.sided ? 'Sí (izquierdo y derecho)' : 'No'],
              ['Limitaciones', t.limitations],
            ] as [string, string | null][]
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-medium">{k}</dt>
                <dd className="whitespace-pre-line">{v}</dd>
              </div>
            ))}
        </dl>
        {t.formulas.length ? (
          <div className="mt-3 text-sm">
            <p className="font-medium">Métricas derivadas</p>
            <ul className="list-inside list-disc text-muted">
              {t.formulas.map((f) => (
                <li key={f.id}>
                  {f.name}: {f.definition}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Card title="Fiabilidad y error de medida">
        {t.reliability.length === 0 ? (
          <EmptyState>
            Error de medida desconocido: se mostrará la diferencia entre evaluaciones, sin
            veredicto. Registra la fiabilidad propia del centro (test-retest) para poder interpretar
            cambios.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {t.reliability.map((r) => (
              <li key={r.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.isLocal ? 'accent' : 'ok'}>
                    {r.isLocal ? 'Test-retest del centro' : 'Publicada'}
                  </Badge>
                  {r.population ? <span className="text-muted">{r.population}</span> : null}
                  {r.measurementMethod ? (
                    <span className="text-muted">· {r.measurementMethod}</span>
                  ) : null}
                  {r.isLocal && !t.isGlobal ? null : null}
                  {r.isLocal ? <DeleteReliabilityButton id={r.id} /> : null}
                </div>
                <p className="tabular-nums">
                  {[
                    r.icc != null ? `ICC ${r.icc}` : null,
                    r.cvPercent != null ? `CV ${r.cvPercent} %` : null,
                    r.sem != null ? `SEM ${r.sem} ${r.semUnit ?? ''}` : null,
                    r.mdc95 != null ? `MDC95 ${r.mdc95} ${r.semUnit ?? ''}` : null,
                    r.swc != null ? `SWC ${r.swc}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {r.notes ? <p className="text-xs text-muted">{r.notes}</p> : null}
                {r.source ? (
                  <p className="text-xs">
                    {r.source.label} — {r.source.title}{' '}
                    <Identifiers doi={r.source.doi} pmid={r.source.pmid} />
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-sm font-medium">
            Registrar fiabilidad propia (test-retest del centro)
          </p>
          <LocalReliabilityForm testId={t.id} unit={t.unit} />
        </div>
      </Card>

      <Card
        title="Valores de referencia"
        actions={
          <Link
            href="/app/informes/importar?que=reference_values"
            className="text-sm text-accent underline"
          >
            Importar normas del centro
          </Link>
        }
      >
        {t.references.length === 0 ? (
          <EmptyState>Referencia insuficiente: no se compara con normas.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {t.references.map((r) => (
              <li key={r.id} className="flex flex-col gap-1">
                <p>
                  {r.organizationId ? <Badge tone="accent">Del centro</Badge> : null}{' '}
                  <span className="font-medium">{r.population}</span>
                  {r.ageMin != null || r.ageMax != null
                    ? ` · ${r.ageMin ?? '…'}–${r.ageMax ?? '…'} años`
                    : ''}
                  {r.sex
                    ? ` · ${r.sex === 'female' ? 'mujeres' : r.sex === 'male' ? 'hombres' : 'mixto'}`
                    : ''}
                  {r.measurementMethod ? ` · ${r.measurementMethod}` : ''}
                </p>
                <p className="tabular-nums text-muted">
                  {r.variable} ({r.unit}): {fmtValues(r.values as Record<string, unknown>)}
                </p>
                {r.applicabilityNotes ? (
                  <p className="text-xs text-muted">{r.applicabilityNotes}</p>
                ) : null}
                <p className="text-xs">
                  {r.source.label} — {r.source.title}{' '}
                  <Identifiers doi={r.source.doi} pmid={r.source.pmid} />
                </p>
                {r.limitations ? (
                  <p className="text-xs text-muted">Limitaciones: {r.limitations}</p>
                ) : null}
                {r.organizationId ? <DeleteReferenceButton id={r.id} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {t.sources.length ? (
        <Card title="Fuentes">
          <ul className="flex flex-col gap-2 text-sm">
            {t.sources.map((s) => (
              <li key={s.id}>
                <Link href={`/app/science/sources/${s.id}`} className="underline">
                  {s.title}
                </Link>{' '}
                — {s.label} <Identifiers doi={s.doi} pmid={s.pmid} />
                <PubMedAttribution method={s.verificationMethod} />
              </li>
            ))}
          </ul>
          <div className="mt-2">
            <SourceButton
              evidence={await evidenceCards(ctx, { sourceIds: t.sources.map((s) => s.id) })}
              label="Ficha de las fuentes"
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
