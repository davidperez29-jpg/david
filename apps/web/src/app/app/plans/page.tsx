import Link from 'next/link';
import { listPlanTemplates } from '@tp/application';
import { Badge, Card } from '@/components/ui/card';
import { label } from '@/lib/labels';
import { requireStaff } from '@/server/session';

export default async function PlansHome() {
  const ctx = await requireStaff();
  const templates = await listPlanTemplates(ctx);
  const goals = [...new Set(templates.map((t) => t.goalSlug ?? ''))];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Plantillas de planificación</h1>
      <p className="text-sm text-muted">
        Puntos de partida, no recetas. Cada plan se crea desde la ficha del cliente (pestaña
        «Planificación»): elige plantilla, fecha de inicio y días, y adáptalo. Las dosis siguen las
        variables de los métodos enlazados; la ola de RIR y la descarga son recomendaciones
        prácticas (F).
      </p>
      {goals.map((g) => (
        <Card key={g} title={g ? label('goalSlug', g) : 'Propias'}>
          <ul className="divide-y divide-border">
            {templates
              .filter((t) => (t.goalSlug ?? '') === g)
              .map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link
                    href={`/app/plans/templates/${t.id}`}
                    className="font-medium hover:underline"
                  >
                    {t.name}
                  </Link>
                  <span className="flex flex-wrap items-center gap-1 text-xs text-muted">
                    {t.sessionsPerWeek} días · {t.durationMonths} meses
                    {t.isGlobal ? null : <Badge tone="accent">Propia</Badge>}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
