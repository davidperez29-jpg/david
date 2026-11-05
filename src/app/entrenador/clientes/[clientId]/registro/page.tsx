import { ChevronDown, MessageCircle } from 'lucide-react';
import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatDate, formatNumber } from '@/domain/format';
import { OriginBadge } from '@/features/shared/provenance';
import { SessionStatusBadge } from '@/features/shared/status-badge';
import { getTrainerContext } from '@/server/context';
import { getClientTrainingLog } from '@/server/services/client-file';

export const metadata: Metadata = { title: 'Ficha · Registro de entrenamiento' };

export default async function ClientTrainingLogTab(
  props: PageProps<'/entrenador/clientes/[clientId]/registro'>,
) {
  const { clientId } = await props.params;
  const entries = await getClientTrainingLog(await getTrainerContext(), clientId);
  if (!entries) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink-900">Registro de entrenamiento</h2>
        <p className="flex items-center gap-2 text-xs text-ink-500">
          Repeticiones, cargas, RIR/RPE y comentarios: <OriginBadge origin="self_reported" />
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-500">Sin registros en las últimas cuatro semanas.</p>
      ) : null}
      {entries.map((entry) => (
        <details
          key={entry.sessionId}
          className="group rounded-3xl border border-line/70 bg-white shadow-soft"
        >
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-5">
            <div className="min-w-0">
              <p className="font-bold text-ink-900">{entry.title}</p>
              <p className="text-sm text-ink-500">
                {formatDate(entry.date, 'long')} · {entry.completedSets}/{entry.plannedSets} series
                {entry.perceivedEffort !== null
                  ? ` · esfuerzo percibido ${entry.perceivedEffort}/10`
                  : ''}
              </p>
            </div>
            <span className="flex items-center gap-2">
              <SessionStatusBadge status={entry.status} />
              <ChevronDown
                aria-hidden
                className="size-4 text-ink-500 transition-transform group-open:rotate-180"
              />
            </span>
          </summary>
          <div className="space-y-4 border-t border-line p-5">
            {entry.comment ? (
              <p className="flex gap-2 rounded-2xl bg-cream-50 p-3 text-sm text-ink-700 ring-1 ring-line">
                <MessageCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-sun-700" />
                <span>
                  <span className="font-bold text-ink-900">Observaciones del cliente: </span>
                  {entry.comment}
                </span>
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm tabular-nums">
                <thead className="text-xs text-ink-500">
                  <tr>
                    <th scope="col" className="py-1.5 pr-3 font-semibold">
                      Ejercicio
                    </th>
                    <th scope="col" className="py-1.5 pr-3 font-semibold">
                      Prescrito
                    </th>
                    <th scope="col" className="py-1.5 pr-3 font-semibold">
                      Realizado
                    </th>
                    <th scope="col" className="py-1.5 font-semibold">
                      Valoración
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line align-top">
                  {entry.exercises.map((exercise) => (
                    <tr key={exercise.prescriptionId}>
                      <th scope="row" className="py-2 pr-3 font-semibold text-ink-900">
                        <span className="text-sun-700">{exercise.slot}</span> {exercise.name}
                      </th>
                      <td className="py-2 pr-3 text-ink-500">{exercise.prescribed}</td>
                      <td className="py-2 pr-3 text-ink-700">
                        {exercise.sets.length === 0
                          ? '—'
                          : exercise.sets
                              .map((set) =>
                                !set.completed
                                  ? `S${set.setNumber}: no`
                                  : exercise.repUnit === 'reps'
                                    ? `${set.reps}${set.loadKg !== null ? ` × ${formatNumber(set.loadKg)} kg` : ''}`
                                    : 'hecha',
                              )
                              .join(' · ')}
                      </td>
                      <td className="py-2 text-ink-700">{exercise.feedback ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
