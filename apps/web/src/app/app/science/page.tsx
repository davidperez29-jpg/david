import Link from 'next/link';
import { listMethods } from '@tp/application';
import { StatusBadge } from '@/components/science/evidence';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { label, LABELS } from '@/lib/labels';
import { requireStaff } from '@/server/session';
import { NewMethodForm } from './science-forms';

export default async function MethodsPage() {
  const ctx = await requireStaff();
  const methods = await listMethods(ctx);
  const kinds = Object.keys(LABELS.methodKind);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Cada método enlaza sus variables (series, repeticiones, descansos…) con afirmaciones
        graduadas A–H, y estas con hallazgos y fuentes verificables. Lo que no tiene evidencia se
        muestra como recomendación práctica (F) u opinión (G).
      </p>
      {methods.length === 0 ? <EmptyState>Todavía no hay métodos.</EmptyState> : null}
      {kinds.map((k) => {
        const list = methods.filter((m) => m.kind === k);
        if (!list.length) return null;
        return (
          <Card key={k} title={label('methodKind', k)}>
            <ul className="divide-y divide-border">
              {list.map((m) => (
                <li key={m.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/app/science/methods/${m.id}`}
                      className="font-medium hover:underline"
                    >
                      {m.name}
                    </Link>
                    {m.summaryForTrainer ? (
                      <p className="line-clamp-2 text-sm text-muted">{m.summaryForTrainer}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
                    <span>{m.claims} afirmación(es)</span>
                    <span>· {m.exercises} ejercicio(s)</span>
                    <StatusBadge status={m.status} />
                    {m.isGlobal ? <Badge tone="accent">Global</Badge> : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      <Card title="Nuevo método">
        <NewMethodForm />
      </Card>
    </div>
  );
}
