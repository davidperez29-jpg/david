import Link from 'next/link';
import { getSource, listScienceTaxonomies } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import {
  Identifiers,
  LevelBadge,
  PubMedAttribution,
  QaList,
  VerificationBadge,
} from '@/components/science/evidence';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDateTime, label } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import {
  AddFindingForm,
  DeleteFindingButton,
  ReviewForm,
  VerifySourceForm,
} from '../../science-forms';

export default async function SourcePage({ params }: { params: Promise<{ sourceId: string }> }) {
  const ctx = await requireStaff();
  const { sourceId } = await params;
  const s = await getSource(ctx, sourceId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  const tax = s.isGlobal ? null : await listScienceTaxonomies(ctx);
  const canPublish = ctx.actor.roles.includes('ADMIN');
  const rows: [string, string | null | undefined][] = [
    ['Población', s.populationSummary],
    ['Edad', s.ageRange],
    [
      'Sexo',
      s.sex
        ? { female: 'Mujeres', male: 'Hombres', mixed: 'Mixto', unknown: 'No indicado' }[s.sex]
        : null,
    ],
    ['Deporte', s.sport],
    ['Intervención', s.intervention],
    ['Comparación', s.comparison],
    ['Resultados medidos', s.outcomesMeasured],
    ['Resumen de resultados', s.resultsSummary],
    ['Limitaciones', s.limitations],
    ['Aplicación práctica', s.practicalApplication],
  ];
  return (
    <div className="flex flex-col gap-4">
      <Link href="/app/science/sources" className="text-sm text-muted hover:underline">
        ← Fuentes
      </Link>
      <Card>
        <h2 className="text-lg font-semibold">{s.title}</h2>
        <p className="text-sm text-muted">
          {s.authors.join(', ') || 'Autoría no indicada'} · {s.year ?? 's. f.'}
          {s.journal ? ` · ${s.journal}` : ''}
          {s.volume ? ` ${s.volume}` : ''}
          {s.issue ? `(${s.issue})` : ''}
          {s.pages ? `:${s.pages}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge>{label('studyDesign', s.studyDesign)}</Badge>
          <VerificationBadge status={s.verificationStatus} />
          <Badge>{label('sourceAccess', s.access)}</Badge>
          {s.isGlobal ? <Badge tone="accent">Global (solo lectura)</Badge> : null}
          <Identifiers doi={s.doi} pmid={s.pmid} />
          {s.url ? (
            <a
              href={s.url}
              className="text-accent underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Enlace
            </a>
          ) : null}
        </div>
        {s.verifiedAt ? (
          <p className="mt-1 text-xs text-muted">
            Verificada el {formatDateTime(s.verifiedAt)}: {s.verificationMethod}
          </p>
        ) : null}
        <PubMedAttribution method={s.verificationMethod} />
        {s.corrections ? <p className="mt-1 text-xs">Correcciones: {s.corrections}</p> : null}
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[12rem_1fr]">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-medium">{k}</dt>
                <dd className="whitespace-pre-line">{v}</dd>
              </div>
            ))}
        </dl>
      </Card>

      <Card title={`Hallazgos (${s.findings.length})`}>
        {s.findings.length === 0 ? (
          <EmptyState>
            Sin hallazgos. Cada hallazgo es un resultado, en una población y una variable.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-4">
            {s.findings.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <LevelBadge level={f.evidenceLevel} />
                  <span className="font-medium">{f.outcome}</span>
                  <span className="text-muted">· {f.population}</span>
                  {f.effectValue != null ? (
                    <span className="text-muted">
                      · {f.effectMetric ?? 'efecto'} {f.effectValue}
                      {f.ciLow != null && f.ciHigh != null ? ` (IC ${f.ciLow} a ${f.ciHigh})` : ''}
                    </span>
                  ) : null}
                  <span className="ml-auto flex gap-1">
                    {!s.isGlobal ? (
                      <Link
                        href={`/app/science/claims/new?finding=${f.id}`}
                        className="text-xs underline"
                      >
                        Crear afirmación
                      </Link>
                    ) : null}
                    {!s.isGlobal ? <DeleteFindingButton findingId={f.id} /> : null}
                  </span>
                </div>
                {f.intervention || f.comparator ? (
                  <p className="text-xs text-muted">
                    {f.intervention}
                    {f.comparator ? ` vs ${f.comparator}` : ''}
                  </p>
                ) : null}
                {f.quote ? (
                  <blockquote className="border-l-2 border-border pl-2 italic">
                    «{f.quote}»
                  </blockquote>
                ) : null}
                <p className="text-xs text-muted">{f.gradingExplanation}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Control de calidad">
        <QaList issues={s.qa} />
      </Card>

      {!s.isGlobal && canPublish ? (
        <Card title="Verificación">
          <p className="mb-3 text-sm text-muted">
            Compara título, autores, año, DOI/PMID y cifras con la fuente original. Mientras no esté
            verificada, sus hallazgos son nivel H y no respaldan recomendaciones.
          </p>
          <VerifySourceForm sourceId={s.id} status={s.verificationStatus} />
        </Card>
      ) : null}

      {!s.isGlobal && tax ? (
        <Card title="Añadir hallazgo">
          <AddFindingForm sourceId={s.id} tax={tax} />
        </Card>
      ) : null}

      <Card title="Revisiones">
        {s.reviews.length === 0 ? (
          <p className="text-sm text-muted">Sin revisiones.</p>
        ) : (
          <ul className="mb-3 text-sm">
            {s.reviews.map((r) => (
              <li key={r.id}>
                {r.reviewedOn} · {label('reviewOutcome', r.outcome)}
                {r.notes ? ` — ${r.notes}` : ''}
              </li>
            ))}
          </ul>
        )}
        {!s.isGlobal && canPublish ? <ReviewForm target="source" targetId={s.id} /> : null}
      </Card>
    </div>
  );
}
