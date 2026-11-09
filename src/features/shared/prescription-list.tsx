import { Clock, Gauge, Lock, Repeat, Timer, Weight } from 'lucide-react';
import { type PrescriptionItemVM, type TrainerPrescriptionItemVM } from '@/contracts/sessions';
import { ExercisePictogram } from '@/features/brand/pictogram';
import { cn } from '@/ui/cn';

/**
 * Lista de solo lectura de los ejercicios de una versión: posición (A1, A2…), series ×
 * repeticiones, carga, esfuerzo, descanso y notas. La nota privada solo aparece si llega
 * (únicamente en los contratos del entrenador).
 */
export function PrescriptionList({
  items,
  className,
}: {
  items: (PrescriptionItemVM | TrainerPrescriptionItemVM)[];
  className?: string;
}) {
  return (
    <ol className={cn('space-y-3', className)}>
      {items.map((item) => {
        const chips = [
          { icon: Repeat, label: 'Series × repeticiones', value: item.setsAndReps },
          { icon: Weight, label: 'Carga', value: item.loadLabel },
          item.effortLabel ? { icon: Gauge, label: 'Esfuerzo', value: item.effortLabel } : null,
          { icon: Clock, label: 'Descanso', value: item.restLabel },
          item.tempoLabel ? { icon: Timer, label: 'Tempo', value: item.tempoLabel } : null,
        ].filter((chip) => chip !== null);
        const privateNote = 'privateNote' in item ? item.privateNote : null;
        return (
          <li key={item.id} className="rounded-3xl bg-white p-4 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sun-200 font-display font-extrabold text-sun-800">
                {item.slot}
              </span>
              <ExercisePictogram silhouette={item.silhouette} className="size-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-ink-900">{item.name}</h3>
                <dl className="mt-2 flex flex-wrap gap-1.5">
                  {chips.map(({ icon: Icon, label, value }) => (
                    <div
                      key={label}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-cream-100 px-2.5 py-1.5 text-sm ring-1 ring-line"
                    >
                      <Icon aria-hidden className="size-3.5 text-sun-700" />
                      <dt className="sr-only">{label}</dt>
                      <dd className="font-semibold text-ink-900">{value}</dd>
                    </div>
                  ))}
                </dl>
                {item.setExceptions.length > 0 ? (
                  <ul className="mt-2 text-sm text-ink-700">
                    {item.setExceptions.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                ) : null}
                {item.clientNote ? (
                  <p className="mt-2 text-sm text-ink-700">{item.clientNote}</p>
                ) : null}
                {privateNote ? (
                  <p className="mt-2 flex gap-1.5 rounded-xl bg-plum-100/60 px-3 py-2 text-sm text-plum-700">
                    <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      <span className="font-bold">Nota privada: </span>
                      {privateNote}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
