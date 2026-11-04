import { Clock, Gauge, Repeat, Timer, Weight } from 'lucide-react';
import { type ExerciseInSessionVM } from '@/contracts/shared';
import { cn } from '@/ui/cn';

/** Fichas de prescripción de un ejercicio: series × repeticiones, carga, descanso, tempo y esfuerzo. */
export function PrescriptionChips({
  exercise,
  className,
}: {
  exercise: ExerciseInSessionVM;
  className?: string;
}) {
  const chips = [
    { icon: Repeat, label: 'Series × repeticiones', value: exercise.setsAndReps },
    { icon: Weight, label: 'Carga', value: exercise.loadLabel },
    { icon: Clock, label: 'Descanso', value: exercise.restLabel },
    exercise.tempo ? { icon: Timer, label: 'Tempo', value: exercise.tempo.code } : null,
    exercise.effortLabel ? { icon: Gauge, label: 'Esfuerzo', value: exercise.effortLabel } : null,
  ].filter((chip) => chip !== null);
  return (
    <dl className={cn('flex flex-wrap gap-1.5', className)}>
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
  );
}
