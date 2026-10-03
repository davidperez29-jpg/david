import { listConsents } from '@tp/application';
import { requireClientUser } from '@/server/session';
import { ClientConsents } from './consents';

export default async function PrivacyPage() {
  const ctx = await requireClientUser();
  const data = await listConsents(ctx, ctx.actor.clientId!);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Privacidad</h1>
      <p className="text-sm text-muted">
        Decides qué datos se tratan. Puedes retirar tu consentimiento en cualquier momento; no
        afecta a la licitud del tratamiento anterior.
      </p>
      <ClientConsents clientId={ctx.actor.clientId!} status={data.status} />
      <p className="text-sm text-muted">
        Para ejercer tus derechos de acceso, rectificación, supresión o portabilidad, contacta con
        tu entrenador/a. La exportación directa desde la app estará disponible próximamente.
      </p>
    </div>
  );
}
