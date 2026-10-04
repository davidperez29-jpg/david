import { listClientPrivacyRequests, listConsents } from '@tp/application';
import { ClientRights } from '@/components/privacy/rights';
import { requireClientUser } from '@/server/session';
import { ClientConsents } from './consents';

export default async function PrivacyPage() {
  const ctx = await requireClientUser();
  const clientId = ctx.actor.clientId!;
  const [data, requests] = await Promise.all([
    listConsents(ctx, clientId),
    listClientPrivacyRequests(ctx, clientId),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Privacidad</h1>
      <p className="text-sm text-muted">
        Decides qué datos se tratan. Puedes retirar tu consentimiento en cualquier momento; no
        afecta a la licitud del tratamiento anterior.
      </p>
      <ClientConsents clientId={clientId} status={data.status} />
      <ClientRights clientId={clientId} requests={requests} />
      <p className="text-xs text-muted">
        Si no estás conforme con la respuesta, puedes reclamar ante la Agencia Española de
        Protección de Datos (aepd.es).
      </p>
    </div>
  );
}
