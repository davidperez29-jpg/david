import Link from 'next/link';
import { clientAgenda, getClient, getReadiness } from '@tp/application';
import { ReferralBanner } from '@/components/referral-banner';
import { ReadinessCard } from '@/components/sessions/readiness';
import { label } from '@/lib/labels';
import { requireClientUser } from '@/server/session';

const fmt = (d: string) =>
  new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${d}T00:00:00Z`));

export default async function ClientToday() {
  const ctx = await requireClientUser();
  const clientId = ctx.actor.clientId!;
  const [me, agenda] = await Promise.all([getClient(ctx, clientId), clientAgenda(ctx, clientId)]);
  const ready = await getReadiness(ctx, clientId, agenda.today);
  const next = agenda.next;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted first-letter:uppercase">{fmt(agenda.today)}</p>
      <h1 className="text-2xl font-bold">Hola, {me.firstName}</h1>
      <ReferralBanner text={me.referral.text} />
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
          {next?.isToday ? 'Entrenamiento de hoy' : 'Próximo entrenamiento'}
        </h2>
        {next ? (
          <>
            <p className="mt-2 text-lg font-medium">{next.title ?? `Sesión ${next.dayLabel}`}</p>
            <p className="mt-1 text-sm text-muted first-letter:uppercase">
              {next.isToday ? 'Hoy' : fmt(next.date!)}
              {next.estimatedDurationMin ? ` · unos ${next.estimatedDurationMin} min` : ''}
              {next.attendance ? ` · ${label('attendance', next.attendance)}` : ''}
            </p>
            {next.objective ? <p className="mt-1 text-sm">{next.objective}</p> : null}
            <Link
              href={`/me/sesion/${next.id}`}
              className="mt-4 flex h-12 items-center justify-center rounded-md bg-accent font-medium text-accent-contrast"
            >
              {next.isToday ? 'Empezar' : 'Ver sesión'}
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-lg font-medium">
              Tu entrenador/a todavía no ha publicado sesiones.
            </p>
            <p className="mt-1 text-sm text-muted">
              Cuando las publique aparecerán aquí, con instrucciones, vídeo y registro rápido.
            </p>
          </>
        )}
      </section>
      <ReadinessCard
        clientId={clientId}
        day={agenda.today}
        initial={
          ready
            ? { energy: ready.energy, sleepQuality: ready.sleepQuality, soreness: ready.soreness }
            : null
        }
      />
    </div>
  );
}
