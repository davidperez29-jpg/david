import Link from 'next/link';
import { getMonitoringRules } from '@tp/application';
import { RulesEditor } from '@/components/monitoring/actions';
import { formatDateTime } from '@/lib/labels';
import { requireStaff } from '@/server/session';

export default async function AlertRulesPage() {
  const ctx = await requireStaff();
  const r = await getMonitoringRules(ctx);
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/app/alerts" className="text-sm text-muted hover:underline">
        ← Alertas
      </Link>
      <h1 className="text-2xl font-semibold">Reglas de alerta</h1>
      <p className="text-sm text-muted">
        {r.version
          ? `Versión ${r.version} del centro${r.publishedAt ? `, publicada el ${formatDateTime(r.publishedAt)}` : ''}.`
          : 'Valores por defecto de la plataforma (el centro aún no los ha cambiado).'}{' '}
        Los umbrales son recomendaciones prácticas (nivel F): ajústalos a tu población. Cada cambio
        crea una versión nueva y queda en el historial. Cada regla se puede desactivar para un
        cliente concreto desde su ficha.
      </p>
      <RulesEditor rules={r.rules} editable={ctx.actor.roles.includes('ADMIN')} />
    </div>
  );
}
