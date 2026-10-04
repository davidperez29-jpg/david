import Link from 'next/link';
import { getMethod, listClaims, listScienceTaxonomies } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { Identifiers, LevelBadge, StatusBadge } from '@/components/science/evidence';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { label } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import { MethodEditor, StatusActions } from '../../science-forms';

type ClaimView = NonNullable<Awaited<ReturnType<typeof getMethod>>['notes'][number]['claim']>;

function ClaimTrace({ claim }: { claim: ClaimView | null }) {
  if (!claim) {
    return (
      <p className="text-xs text-muted">
        Sin afirmación que lo respalde: <strong>recomendación práctica (F) u opinión (G)</strong>.
      </p>
    );
  }
  return (
    <details className="text-sm">
      {/* No links inside <summary> (nested interactive controls): the link goes in the body. */}
      <summary className="cursor-pointer py-1">
        <span className="inline-flex flex-wrap items-center gap-2">
          <LevelBadge level={claim.level} />
          {claim.statement}
        </span>
      </summary>
      <div className="mt-2 flex flex-col gap-2 border-l-2 border-border pl-3">
        <Link
          href={`/app/science/claims/${claim.id}`}
          className="inline-flex min-h-6 items-center self-start text-xs text-accent underline"
        >
          Abrir la afirmación
        </Link>
        <p className="text-xs text-muted">
          {label('epistemic', claim.epistemicType)} · confianza{' '}
          {label('confidence', claim.confidence).toLowerCase()} ·{' '}
          {label('scienceStatus', claim.status).toLowerCase()}
        </p>
        {claim.limitations ? <p className="text-xs">Limitaciones: {claim.limitations}</p> : null}
        {claim.evidence.map((e) => (
          <div key={e.findingId} className="text-xs">
            <span className="font-medium">{label('evidenceRole', e.role)}</span> · [{e.level}]{' '}
            {e.sourceTitle} ({e.sourceYear ?? 's. f.'}) — {e.outcome}, {e.population}.{' '}
            <Identifiers doi={e.doi} pmid={e.pmid} />
            {e.quote ? (
              <blockquote className="mt-1 italic text-muted">«{e.quote}»</blockquote>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  );
}

export default async function MethodPage({ params }: { params: Promise<{ methodId: string }> }) {
  const ctx = await requireStaff();
  const { methodId } = await params;
  const m = await getMethod(ctx, methodId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  const canPublish = ctx.actor.roles.includes('ADMIN');
  const [claims, tax] = m.isGlobal
    ? [null, null]
    : await Promise.all([listClaims(ctx, { limit: 100 }), listScienceTaxonomies(ctx)]);
  const blocked = [
    ...(m.definition?.trim() ? [] : ['falta la definición.']),
    ...m.variables.filter((v) => !v.claim).map((v) => `«${v.variableKey}» sin justificar.`),
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/app/science" className="text-sm text-muted hover:underline">
          ← Métodos
        </Link>
        <h2 className="text-xl font-semibold">{m.name}</h2>
        <Badge>{label('methodKind', m.kind)}</Badge>
        <StatusBadge status={m.status} />
        {m.isGlobal ? <Badge tone="accent">Global (solo lectura)</Badge> : null}
      </div>
      {m.definition ? <p>{m.definition}</p> : null}
      {m.summaryForTrainer ? (
        <Card title="Para el entrenador">
          <p className="text-sm whitespace-pre-line">{m.summaryForTrainer}</p>
        </Card>
      ) : null}

      <Card title="Variables de dosis y su justificación">
        {m.variables.length === 0 ? (
          <EmptyState>Sin variables definidas.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {m.variables.map((v) => (
              <li key={v.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-sm">{v.variableKey}</span>
                  <span className="text-sm">
                    {v.minValue ?? '—'}–{v.maxValue ?? '—'} {v.unit ?? ''}
                  </span>
                  {v.population ? (
                    <span className="text-xs text-muted">({v.population})</span>
                  ) : null}
                  {v.notes ? <span className="text-xs text-muted">{v.notes}</span> : null}
                </div>
                <ClaimTrace claim={v.claim} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Notas">
        {m.notes.length === 0 ? (
          <EmptyState>Sin notas.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {m.notes.map((n) => (
              <li key={n.id} className="flex flex-col gap-1">
                <p className="text-sm">
                  <Badge>{label('methodNoteKind', n.kind)}</Badge> {n.text}
                </p>
                <ClaimTrace claim={n.claim} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {m.evidence.length ? (
        <Card title="Otros hallazgos enlazados">
          <ul className="flex flex-col gap-2 text-sm">
            {m.evidence.map((e) => (
              <li key={e.findingId}>
                {label('evidenceRole', e.role)} · [{e.level}]{' '}
                <Link href={`/app/science/sources/${e.sourceId}`} className="underline">
                  {e.sourceTitle}
                </Link>{' '}
                ({e.year ?? 's. f.'}) — {e.outcome}. <Identifiers doi={e.doi} pmid={e.pmid} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title={`Ejercicios que usan este método (${m.exercises.length})`}>
        {m.exercises.length === 0 ? (
          <p className="text-sm text-muted">
            Se enlazan desde la ficha del ejercicio, pestaña «Métodos».
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {m.exercises.map((e) => (
              <li key={e.id}>
                <Link href={`/app/library/${e.id}`} className="underline">
                  {e.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!m.isGlobal && claims && tax ? (
        <>
          <Card title="Estado">
            <StatusActions
              path={`/science/methods/${m.id}`}
              status={m.status}
              canPublish={canPublish}
              blocked={blocked}
            />
          </Card>
          <Card title="Editar">
            <MethodEditor
              method={m}
              claims={claims.items.map((c) => ({
                id: c.id,
                key: c.key,
                statement: c.statement,
                level: c.evidenceLevel,
              }))}
              populations={tax.populations}
            />
          </Card>
        </>
      ) : null}
    </div>
  );
}
