import Link from 'next/link';
import { clientDashboard, getClient, getReadiness } from '@tp/application';
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

/** Client "Hoy" (§9.2): today's (or the next) session with its exercises, one big button. */
export default async function ClientToday() {
  const ctx = await requireClientUser();
  const clientId = ctx.actor.clientId!;
  const [me, dash] = await Promise.all([getClient(ctx, clientId), clientDashboard(ctx, clientId)]);
  const ready = await getReadiness(ctx, clientId, dash.today);
  const next = dash.next;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted first-letter:uppercase">{fmt(dash.today)}</p>
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
            <Link
              href={`/me/sesion/${next.id}`}
              className="mt-4 flex h-14 items-center justify-center rounded-md bg-accent text-lg font-semibold text-accent-contrast"
            >
              {next.isToday ? 'Empezar ▶' : 'Ver sesión'}
            </Link>
            {next.preview.length ? (
              <ol className="mt-4 flex flex-col gap-1 text-sm" aria-label="Ejercicios de la sesión">
                {next.preview.slice(0, 8).map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-5 text-muted tabular-nums">{i + 1}</span>
                    <span className="flex-1">
                      {e.name}
                      {e.short ? (
                        <span className="block text-xs text-muted tabular-nums">{e.short}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
                {next.preview.length > 8 ? (
                  <li className="text-muted">y {next.preview.length - 8} más</li>
                ) : null}
              </ol>
            ) : null}
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
      {dash.streak > 0 || dash.adherence28.planned ? (
        <p className="text-sm" role="status">
          {dash.streak > 1
            ? `Llevas ${dash.streak} sesiones seguidas. ¡Sigue así!`
            : dash.streak === 1
              ? 'Hiciste tu última sesión. ¡Bien!'
              : 'Hoy es buen día para retomar.'}
        </p>
      ) : null}
      {dash.nextAssessment ? (
        <p className="rounded-md border border-border p-3 text-sm">
          Próxima evaluación:{' '}
          <span className="first-letter:uppercase">{fmt(dash.nextAssessment.date)}</span>. Tu
          entrenador/a te explicará las pruebas.
        </p>
      ) : null}
      <ReadinessCard
        clientId={clientId}
        day={dash.today}
        initial={
          ready
            ? { energy: ready.energy, sleepQuality: ready.sleepQuality, soreness: ready.soreness }
            : null
        }
      />
    </div>
  );
}
