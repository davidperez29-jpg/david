'use client';

import { Button } from '@/components/ui/button';
import { FormError, useApiAction } from '@/components/use-form';
import { label } from '@/lib/labels';

const EXPLAIN: Record<string, string> = {
  service_terms: 'Tratamiento de tus datos de entrenamiento para prestarte el servicio.',
  health_data:
    'Lesiones, molestias y otra información de salud que declares, para adaptar tu entrenamiento. No se realizan diagnósticos.',
  photo: 'Fotografías de progreso o para tu ficha.',
  marketing: 'Novedades y ofertas por email.',
};

export function ClientConsents({
  clientId,
  status,
}: {
  clientId: string;
  status: { purpose: string; currentVersion: string; active: boolean }[];
}) {
  const { run, pending, error } = useApiAction();
  return (
    <ul className="flex flex-col gap-3">
      {status.map((s) => (
        <li key={s.purpose} className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">{label('consentPurpose', s.purpose)}</h2>
            <span className={`text-sm ${s.active ? 'text-ok' : 'text-muted'}`}>
              {s.active ? 'Otorgado' : 'No otorgado'}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{EXPLAIN[s.purpose]}</p>
          <Button
            className="mt-3 w-full"
            size="lg"
            variant={s.active ? 'secondary' : 'primary'}
            disabled={pending}
            onClick={() =>
              s.active
                ? run(`/clients/${clientId}/consents/${s.purpose}`, 'DELETE')
                : run(`/clients/${clientId}/consents`, 'POST', {
                    purpose: s.purpose,
                    method: 'in_app',
                  })
            }
          >
            {s.active ? 'Retirar consentimiento' : 'Otorgar consentimiento'}
          </Button>
        </li>
      ))}
      <FormError error={error} />
    </ul>
  );
}
