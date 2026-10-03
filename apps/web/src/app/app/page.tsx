import Link from 'next/link';
import { listClients, listClientsNeedingReferral } from '@tp/application';
import { Badge, Card, EmptyState, Stat } from '@/components/ui/card';
import { requireStaff } from '@/server/session';

export default async function TodayPage() {
  const ctx = await requireStaff();
  const page = await listClients(ctx, { limit: 100 });
  const active = page.items.filter((c) => c.status === 'active');
  // Phase 1: attention list = referral flags and clients without a primary goal.
  const referral = await listClientsNeedingReferral(ctx);
  const noGoal = page.items.filter((c) => !c.primaryGoal);
  const noAccount = page.items.filter((c) => !c.hasAccount && c.modality !== 'in_person');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Hoy</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Clientes activos" value={active.length} />
        <Stat label="Requieren atención" value={referral.length + noGoal.length} />
        <Stat label="Sesiones hoy" value="—" hint="Disponible en la Fase 7" />
        <Stat label="Adherencia 28 d" value="—" hint="Disponible en la Fase 8" />
      </div>
      <Card title="Requiere acción">
        {referral.length + noGoal.length + noAccount.length === 0 ? (
          <EmptyState>Nada pendiente.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {referral.map((c) => (
              <li key={`r-${c.id}`} className="flex items-center justify-between gap-2 py-2">
                <span className="flex items-center gap-2">
                  <Badge tone="danger">Atención</Badge>
                  <Link
                    className="font-medium hover:underline"
                    href={`/app/clients/${c.id}?tab=salud`}
                  >
                    {c.firstName} {c.lastName}
                  </Link>
                  <span className="text-sm text-muted">
                    Requiere valoración por profesional sanitario
                  </span>
                </span>
              </li>
            ))}
            {noGoal.map((c) => (
              <li key={`g-${c.id}`} className="flex items-center gap-2 py-2">
                <Badge tone="warn">Revisar</Badge>
                <Link
                  className="font-medium hover:underline"
                  href={`/app/clients/${c.id}?tab=objetivos`}
                >
                  {c.firstName} {c.lastName}
                </Link>
                <span className="text-sm text-muted">Sin objetivo principal</span>
              </li>
            ))}
            {noAccount.map((c) => (
              <li key={`a-${c.id}`} className="flex items-center gap-2 py-2">
                <Badge tone="neutral">Info</Badge>
                <Link className="font-medium hover:underline" href={`/app/clients/${c.id}`}>
                  {c.firstName} {c.lastName}
                </Link>
                <span className="text-sm text-muted">
                  Entrena online sin cuenta en la app: envía la invitación
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
