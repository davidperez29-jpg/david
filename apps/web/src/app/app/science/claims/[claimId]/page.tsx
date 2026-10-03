import Link from 'next/link';
import { getClaim, listScienceTaxonomies } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import {
  citation,
  Identifiers,
  LevelBadge,
  PubMedAttribution,
  QaList,
  StatusBadge,
  VerificationBadge,
} from '@/components/science/evidence';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDate, label } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import { allFindings } from '../../findings';
import { ClaimForm, ReviewForm, StatusActions } from '../../science-forms';

export default async function ClaimPage({ params }: { params: Promise<{ claimId: string }> }) {
  const ctx = await requireStaff();
  const { claimId } = await params;
  const c = await getClaim(ctx, claimId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  const canPublish = ctx.actor.roles.includes('ADMIN');
  const app = (c.applicability as { appliesTo?: string[]; notFor?: string[] } | null) ?? {};
  const [tax, findings] = c.isGlobal
    ? [await listScienceTaxonomies(ctx), null]
    : await Promise.all([listScienceTaxonomies(ctx), allFindings(ctx)]);
  const popName = (slug: string) => tax.populations.find((p) => p.slug === slug)?.name ?? slug;
  const errors = c.qa.filter((i) => i.severity === 'error').map((i) => i.message);
  return (
    <div className="flex flex-col gap-4">
      <Link href="/app/science/claims" className="text-sm text-muted hover:underline">
        ← Afirmaciones
      </Link>
      <Card>
        <p className="text-lg font-medium">{c.statement}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <LevelBadge level={c.evidenceLevel} />
          <StatusBadge status={c.status} />
          <Badge>{label('epistemic', c.epistemicType)}</Badge>
          <span className="text-muted">
            Confianza {label('confidence', c.confidence).toLowerCase()}
          </span>
          {c.scope ? <span className="text-muted">· {c.scope}</span> : null}
          <span className="font-mono text-xs text-muted">· {c.key}</span>
          {c.isGlobal ? <Badge tone="accent">Global (solo lectura)</Badge> : null}
        </div>
        {c.limitations ? (
          <p className="mt-2 text-sm">
            <strong>Limitaciones:</strong> {c.limitations}
          </p>
        ) : null}
        {app.appliesTo?.length ? (
          <p className="mt-1 text-sm">
            <strong>Se aplica a:</strong> {app.appliesTo.map(popName).join(', ')}
          </p>
        ) : null}
        {app.notFor?.length ? (
          <p className="mt-1 text-sm">
            <strong>No se aplica a:</strong> {app.notFor.map(popName).join(', ')}
          </p>
        ) : null}
      </Card>

      <Card title="Evidencia">
        {c.evidence.length === 0 ? (
          <EmptyState>Sin hallazgos enlazados: nivel H (no verificada).</EmptyState>
        ) : (
          <ul className="flex flex-col gap-4">
            {c.evidence.map((e) => (
              <li key={e.findingId} className="flex flex-col gap-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      e.role === 'contradicts' ? 'warn' : e.role === 'supports' ? 'ok' : 'neutral'
                    }
                  >
                    {label('evidenceRole', e.role)}
                  </Badge>
                  <LevelBadge level={e.level} />
                  <VerificationBadge status={e.verificationStatus} />
                  <span className="text-xs text-muted">{label('studyDesign', e.design)}</span>
                </div>
                <p>
                  <Link
                    href={`/app/science/sources/${e.sourceId}`}
                    className="font-medium underline"
                  >
                    {e.sourceTitle}
                  </Link>{' '}
                  — {citation({ authors: e.sourceAuthors, year: e.sourceYear })}
                  {e.journal ? `, ${e.journal}` : ''}
                </p>
                <p className="text-xs text-muted">
                  {e.outcome} · {e.population}
                  {e.intervention ? ` · ${e.intervention}` : ''}
                  {e.comparator ? ` vs ${e.comparator}` : ''}
                  {e.effectValue != null ? ` · ${e.effectMetric ?? 'efecto'} ${e.effectValue}` : ''}
                  {e.ciLow != null && e.ciHigh != null ? ` (IC ${e.ciLow} a ${e.ciHigh})` : ''}
                </p>
                {e.quote ? (
                  <blockquote className="border-l-2 border-border pl-2 italic">
                    «{e.quote}»
                  </blockquote>
                ) : null}
                <Identifiers doi={e.doi} pmid={e.pmid} />
                <PubMedAttribution method={e.verificationMethod} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Control de calidad">
        <QaList issues={c.qa} />
      </Card>

      {c.usedBy.length ? (
        <Card title="Usada por">
          <ul className="text-sm">
            {c.usedBy.map((u) => (
              <li key={`${u.methodId}-${u.variableKey}`}>
                <Link href={`/app/science/methods/${u.methodId}`} className="underline">
                  {u.methodName}
                </Link>{' '}
                · {u.variableKey}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="Revisiones">
        {c.reviews.length === 0 ? (
          <p className="text-sm text-muted">Sin revisiones.</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-1 text-sm">
            {c.reviews.map((r) => (
              <li key={r.id}>
                {formatDate(r.reviewedOn)} · {label('reviewOutcome', r.outcome)}
                {r.notes ? ` — ${r.notes}` : ''}
              </li>
            ))}
          </ul>
        )}
        {canPublish && !c.isGlobal ? <ReviewForm target="claim" targetId={c.id} /> : null}
      </Card>

      {!c.isGlobal && findings ? (
        <>
          <Card title="Estado">
            <StatusActions
              path={`/science/claims/${c.id}`}
              status={c.status}
              canPublish={canPublish}
              blocked={errors}
            />
          </Card>
          <Card title="Editar">
            <ClaimForm claim={c} findings={findings} populations={tax.populations} />
          </Card>
        </>
      ) : null}
    </div>
  );
}
