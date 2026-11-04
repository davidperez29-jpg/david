import { CircleCheck, CircleDashed, CircleX, Lock } from 'lucide-react';
import { type RehabCaseVM, type RehabCriterionVM } from '@/contracts/shared';
import { formatDate } from '@/domain/format';
import { Badge } from '@/ui/badge';
import { cn } from '@/ui/cn';
import { Meter } from '@/ui/meter';

const CRITERION: Record<
  RehabCriterionVM['status'],
  { icon: React.ReactNode; label: string; className: string }
> = {
  met: { icon: <CircleCheck />, label: 'Cumplido', className: 'text-leaf-700' },
  not_met: { icon: <CircleX />, label: 'No cumplido', className: 'text-coral-700' },
  pending: { icon: <CircleDashed />, label: 'Pendiente de valorar', className: 'text-ink-500' },
};

export function HealthDataNotice() {
  return (
    <p className="inline-flex items-center gap-1.5 rounded-full bg-plum-100 px-3 py-1 text-xs font-semibold text-plum-700">
      <Lock aria-hidden className="size-3.5" />
      Datos de salud · acceso restringido al entrenador responsable
    </p>
  );
}

export function RehabTimeline({ rehab }: { rehab: RehabCaseVM }) {
  return (
    <ol className="relative space-y-4">
      {rehab.phases.map((phase) => (
        <li
          key={phase.id}
          className={cn(
            'rounded-3xl border p-5',
            phase.state === 'current' && 'border-sun-300 bg-sun-100',
            phase.state === 'done' && 'border-line bg-white',
            // Las fases futuras se distinguen por el borde discontinuo, no por transparencia (contraste AA).
            phase.state === 'upcoming' && 'border-dashed border-ink-300 bg-cream-50',
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-ink-900">
              <span className="mr-2 inline-grid size-7 place-items-center rounded-lg bg-ink-900 text-sm text-cream-50">
                {phase.order}
              </span>
              {phase.name}
            </h3>
            <Badge
              tone={phase.state === 'done' ? 'leaf' : phase.state === 'current' ? 'sun' : 'outline'}
            >
              {phase.state === 'done'
                ? 'Superada'
                : phase.state === 'current'
                  ? 'Fase actual'
                  : 'Próxima'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-ink-500">{phase.goal}</p>
          <div className="mt-3 flex items-center gap-3">
            <Meter
              value={phase.met}
              max={phase.total}
              label={`Criterios cumplidos en ${phase.name}`}
              tone="leaf"
            />
            <span className="shrink-0 text-xs font-semibold text-ink-700 tabular-nums">
              {phase.met}/{phase.total} criterios
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {phase.criteria.map((criterion) => {
              const style = CRITERION[criterion.status];
              return (
                <li key={criterion.id} className="flex items-start gap-2 text-sm">
                  <span aria-hidden className={cn('mt-0.5 [&>svg]:size-4', style.className)}>
                    {style.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="text-ink-900">{criterion.description}</span>
                    <span className="block text-xs text-ink-500">
                      <span className="sr-only">{style.label}. </span>
                      Definido por{' '}
                      {criterion.definedBy === 'clinician' ? 'la fisioterapeuta' : 'el entrenador'}
                      {criterion.checkedOn
                        ? ` · valorado el ${formatDate(criterion.checkedOn, 'dayMonth')}`
                        : ''}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
