import Link from 'next/link';
import { getClient, getPlayerSession } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { ResolveLogButton, SubstitutionDecision } from '@/components/sessions/review';
import { Badge, Card } from '@/components/ui/card';
import { formatDate, label } from '@/lib/labels';
import { requireStaff } from '@/server/session';

/** Trainer view of an executed session: logs vs prescription, flags, substitutions, feedback. */
export default async function SessionReviewPage({
  params,
}: {
  params: Promise<{ clientId: string; sessionId: string }>;
}) {
  const ctx = await requireStaff();
  const { clientId, sessionId } = await params;
  const s = await getPlayerSession(ctx, sessionId).catch((e) => {
    if (e instanceof DomainError && (e.code === 'not_found' || e.code === 'validation')) notFound();
    throw e;
  });
  if (s.clientId !== clientId) notFound();
  const client = await getClient(ctx, clientId);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/app/clients/${clientId}?tab=programa#sesiones`}
          className="text-sm text-muted hover:underline"
        >
          ← {client.firstName} {client.lastName}
        </Link>
        <h1 className="text-2xl font-semibold">
          {s.dayLabel} · {s.title}
        </h1>
        {s.scheduledDate ? (
          <span className="text-sm text-muted">{formatDate(s.scheduledDate)}</span>
        ) : null}
        {s.published ? <Badge tone="ok">Publicada</Badge> : <Badge>No publicada</Badge>}
        {s.attendance ? (
          <Badge tone={s.attendance.status === 'completed' ? 'ok' : 'warn'}>
            {label('attendance', s.attendance.status)}
          </Badge>
        ) : null}
        <Link
          href={`/app/clients/${clientId}/sessions/${sessionId}/sala`}
          className="ml-auto rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast"
        >
          Modo sala
        </Link>
        <Link
          href={`/app/plans/${s.plan.id}/sessions/${sessionId}`}
          className="text-sm text-accent underline"
        >
          Editar sesión
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Cumplimiento">
          <p className="text-2xl font-semibold tabular-nums">{s.completion.percent} %</p>
          <p className="text-xs text-muted">
            {s.completion.completedSets} de {s.completion.prescribedSets} series registradas
          </p>
        </Card>
        <Card title="Valoración del cliente">
          {s.feedback ? (
            <ul className="text-sm">
              <li>RPE de la sesión (0–10): {s.feedback.sessionRpe ?? '—'}</li>
              <li>
                Fatiga: {s.feedback.fatigue ?? '—'} · Motivación: {s.feedback.motivation ?? '—'}
              </li>
              {s.feedback.pain != null ? (
                <li className="text-warn">Dolor declarado: {s.feedback.pain}/10</li>
              ) : null}
              {s.feedback.comment ? <li className="mt-1 italic">«{s.feedback.comment}»</li> : null}
            </ul>
          ) : (
            <p className="text-sm text-muted">Sin valoración.</p>
          )}
        </Card>
        <Card title="Asistencia">
          {s.attendance ? (
            <p className="text-sm">
              {label('attendance', s.attendance.status)}
              {s.attendance.performedDate ? ` · ${formatDate(s.attendance.performedDate)}` : ''}
              {s.attendance.reasonCode
                ? ` · ${label('absenceReason', s.attendance.reasonCode)}`
                : ''}
              {s.attendance.reasonText ? ` · ${s.attendance.reasonText}` : ''}
            </p>
          ) : (
            <p className="text-sm text-muted">Sin cerrar.</p>
          )}
        </Card>
      </div>

      {s.blocks.flatMap((b) =>
        b.exercises.map((e) => (
          <Card key={e.id} title={`${e.name} · ${e.short}`}>
            {e.substitutions.map((x) => (
              <div key={x.id} className="mb-2 flex flex-col gap-1 text-sm">
                <p>
                  <Badge
                    tone={
                      x.status === 'pending' ? 'warn' : x.status === 'approved' ? 'ok' : 'neutral'
                    }
                  >
                    {x.status === 'pending'
                      ? 'Sustitución pendiente'
                      : x.status === 'approved'
                        ? `Sustituido por ${x.chosenName ?? '—'}`
                        : 'Sustitución rechazada'}
                  </Badge>{' '}
                  Motivo: {label('substitutionReason', x.reason)}
                  {x.comment ? ` · ${x.comment}` : ''}
                </p>
                {x.status === 'pending' ? (
                  <SubstitutionDecision
                    substitutionId={x.id}
                    requested={
                      x.chosenExerciseId
                        ? { id: x.chosenExerciseId, name: x.chosenName ?? '—' }
                        : null
                    }
                    alternatives={e.alternatives.map((a) => ({ id: a.id, name: a.name }))}
                  />
                ) : null}
              </div>
            ))}
            {e.logs.length === 0 ? (
              <p className="text-sm text-muted">Sin registros.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1">Serie</th>
                    <th>Carga</th>
                    <th>Reps</th>
                    <th>RIR</th>
                    <th>Registró</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {e.logs.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="py-1">
                        {l.setIndex}
                        {l.side ? ` (${l.side === 'left' ? 'izq.' : 'dcha.'})` : ''}
                      </td>
                      <td className="tabular-nums">{l.loadKg != null ? `${l.loadKg} kg` : '—'}</td>
                      <td className="tabular-nums">
                        {l.reps ?? (l.durationS != null ? `${l.durationS} s` : '—')}
                      </td>
                      <td className="tabular-nums">
                        {l.rir ?? (l.rpe != null ? `RPE ${l.rpe}` : '—')}
                      </td>
                      <td className="text-xs text-muted">
                        {l.loggedByRole === 'trainer' ? 'Entrenador/a' : 'Cliente'}
                      </td>
                      <td className="text-right">
                        {l.needsReview ? (
                          <span className="flex flex-wrap items-center justify-end gap-2">
                            <span className="text-xs text-warn">{l.reviewReason}</span>
                            <ResolveLogButton logId={l.id} />
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )),
      )}
      {s.orphanLogs.length ? (
        <Card title="Registros de ejercicios eliminados de la sesión">
          <ul className="text-sm">
            {s.orphanLogs.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                Serie {l.setIndex}: {l.loadKg ?? '—'} kg × {l.reps ?? '—'}
                {l.needsReview ? <ResolveLogButton logId={l.id} /> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
