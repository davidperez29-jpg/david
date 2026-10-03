import { getClient } from '@tp/application';
import { ReferralBanner } from '@/components/referral-banner';
import { requireClientUser } from '@/server/session';

export default async function ClientToday() {
  const ctx = await requireClientUser();
  const me = await getClient(ctx, ctx.actor.clientId!);
  const today = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Madrid',
  }).format(new Date());
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted first-letter:uppercase">{today}</p>
      <h1 className="text-2xl font-bold">Hola, {me.firstName}</h1>
      <ReferralBanner text={me.referral.text} />
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
          Entrenamiento de hoy
        </h2>
        <p className="mt-2 text-lg font-medium">
          Tu entrenador/a todavía no ha publicado sesiones.
        </p>
        <p className="mt-1 text-sm text-muted">
          Cuando las publique aparecerán aquí, con instrucciones, vídeo y registro rápido.
        </p>
      </section>
    </div>
  );
}
