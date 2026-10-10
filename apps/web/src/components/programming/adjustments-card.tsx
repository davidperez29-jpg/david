import type { AdjustmentView } from '@tp/application';
import { Why } from '@/components/decision/why';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatDate, formatDateTime, label } from '@/lib/labels';
import {
  AdjustmentActions,
  AutoApplyToggle,
  BulkAcceptButton,
  RefreshAdjustmentsButton,
} from './actions';

/** Only what the buttons need crosses to the client (not targets, preview or explanation). */
const actionsOf = (a: AdjustmentView) => ({
  id: a.id,
  kind: a.kind,
  title: a.title,
  status: a.status,
  params: a.params,
  options: a.options,
});

const FIELD: Record<string, string> = {
  loadKg: 'Carga (kg)',
  sets: 'Series',
  rirMin: 'RIR mín.',
  rirMax: 'RIR máx.',
  exerciseId: 'Ejercicio',
  scheduledDate: 'Día',
};
const KIND: Record<string, string> = {
  load_progression: 'Progresión de carga',
  deload_week: 'Descarga',
  volume_reduction: 'Volumen',
  substitution: 'Sustitución',
  reschedule: 'Días de entrenamiento',
};
const TONE: Record<string, 'accent' | 'ok' | 'danger' | 'warn' | 'neutral'> = {
  proposed: 'accent',
  postponed: 'warn',
  accepted: 'ok',
  accepted_with_changes: 'ok',
  rejected: 'danger',
};
const weekdayDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  });
const fmt = (v: number | string | null) =>
  v == null ? '—' : typeof v === 'number' ? v.toLocaleString('es-ES') : v;

/** What would change (pending) or what changed (applied), per future session. */
function Changes({ a }: { a: AdjustmentView }) {
  const list = a.applied ?? a.preview;
  if (!list.length) return null;
  const names = new Map(a.options.map((o) => [o.id, o.name]));
  const byTarget = new Map(a.targets.map((t) => [t.sessionExerciseId, t]));
  const sessionNames = new Map(
    a.targets.map((t) => [t.sessionId, `Sesión (${t.exerciseName}…)`] as const).reverse(),
  );
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted">
        {a.applied ? 'Cambios aplicados' : 'Qué cambiaría'} ({list.length})
      </summary>
      {/* Keyboard users can scroll the table on a narrow screen (focusable region). */}
      <div
        className="overflow-x-auto"
        role="region"
        aria-label={`${a.applied ? 'Cambios aplicados' : 'Qué cambiaría'}: ${a.title}`}
        tabIndex={0}
      >
        <table className="mt-1 w-full">
          {/* Worded apart from the summary above, so the two are not read as the same text. */}
          <caption className="sr-only">
            Tabla de cambios {a.applied ? 'aplicados' : 'propuestos'} de «{a.title}»: fecha,
            ejercicio, campo y valor antes y después
          </caption>
          <thead>
            <tr className="text-left text-muted">
              <th className="py-0.5">Fecha</th>
              <th>Ejercicio</th>
              <th>Campo</th>
              <th>Antes → después</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c, i) => {
              // A session move (availability): the whole session changes day.
              if (c.field === 'scheduledDate')
                return (
                  <tr key={i} className="border-t border-border tabular-nums">
                    <td className="py-0.5">{formatDate(String(c.from))}</td>
                    <td>{sessionNames.get(c.sessionId ?? '') ?? 'Sesión completa'}</td>
                    <td>{FIELD.scheduledDate}</td>
                    <td>
                      {weekdayDate(String(c.from))} → {weekdayDate(String(c.to))}
                    </td>
                  </tr>
                );
              const t = byTarget.get(c.sessionExerciseId);
              return (
                <tr key={i} className="border-t border-border tabular-nums">
                  <td className="py-0.5">{t ? formatDate(t.date) : '—'}</td>
                  <td>{t?.exerciseName ?? '—'}</td>
                  <td>{FIELD[c.field] ?? c.field}</td>
                  <td>
                    {c.field === 'exerciseId' ? (t?.exerciseName ?? '—') : fmt(c.from)} →{' '}
                    {c.field === 'exerciseId'
                      ? (names.get(String(c.to)) ?? 'otro ejercicio')
                      : fmt(c.to)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * A pending adjustment with what it would change, why, and its decision buttons. `focusId` is the
 * stable heading that receives focus once it is decided and leaves the list.
 */
export function PendingAdjustmentItem({ a, focusId }: { a: AdjustmentView; focusId: string }) {
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{KIND[a.kind] ?? a.kind}</Badge>
        <span id={`adj-${a.id}`} className="font-medium">
          {a.title}
        </span>
        <Badge tone={TONE[a.status] ?? 'neutral'}>{label('recommendationStatus', a.status)}</Badge>
      </div>
      <p className="text-sm text-muted">{a.explanation.proposal}</p>
      <Changes a={a} />
      <Why e={a.explanation} />
      <AdjustmentActions adj={actionsOf(a)} focusId={focusId} />
    </li>
  );
}

/** Heading that keeps the keyboard focus when a decided adjustment leaves the list. */
const FOCUS = 'ajustes-titulo';

export function AdjustmentsCard({
  clientId,
  items,
  autoApply,
}: {
  clientId: string;
  items: AdjustmentView[];
  autoApply: boolean;
}) {
  const pending = items.filter((i) => i.status === 'proposed' || i.status === 'postponed');
  const recent = items.filter((i) => !pending.includes(i)).slice(0, 8);
  const loadIds = pending.filter((i) => i.kind === 'load_progression').map((i) => i.id);
  return (
    <Card
      title={
        <span id="ajustes">
          Ajustes propuestos {pending.length ? <Badge tone="accent">{pending.length}</Badge> : null}
        </span>
      }
      headingId={FOCUS}
      actions={<RefreshAdjustmentsButton clientId={clientId} />}
    >
      <p className="mb-2 text-xs text-muted">
        Calculados tras cada sesión cerrada y cada día a partir de lo registrado y de las alertas de
        seguimiento. Nunca cambian el plan activo por su cuenta: al aceptar se aplican solo a las
        sesiones futuras sin registrar, con una revisión del plan y auditoría.
      </p>
      {pending.length === 0 ? (
        <EmptyState>Sin ajustes pendientes.</EmptyState>
      ) : (
        <>
          <div className="mb-2">
            <BulkAcceptButton clientId={clientId} ids={loadIds} />
          </div>
          <ul className="divide-y divide-border">
            {pending.map((a) => (
              <PendingAdjustmentItem key={a.id} a={a} focusId={FOCUS} />
            ))}
          </ul>
        </>
      )}
      {recent.length ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer">Decididos recientemente ({recent.length})</summary>
          <ul className="mt-1 divide-y divide-border">
            {recent.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span id={`adj-${a.id}`}>{a.title}</span>
                  <Badge tone={TONE[a.status] ?? 'neutral'}>
                    {label('recommendationStatus', a.status)}
                  </Badge>
                  {a.decidedAt ? (
                    <span className="text-xs text-muted">{formatDateTime(a.decidedAt)}</span>
                  ) : null}
                  {a.decisionReason ? (
                    <span className="text-xs text-muted">· {a.decisionReason}</span>
                  ) : null}
                </div>
                <Changes a={a} />
                <AdjustmentActions adj={actionsOf(a)} focusId={FOCUS} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="mt-3 border-t border-border pt-3">
        <AutoApplyToggle clientId={clientId} enabled={autoApply} />
      </div>
    </Card>
  );
}
