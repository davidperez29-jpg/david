import { clientAssessmentProgress, clientMonitoring } from '@tp/application';
import { ProgressView } from '@/components/assessment/progress';
import { requireClientUser } from '@/server/session';

export default async function ClientProgress() {
  const ctx = await requireClientUser();
  const [data, m] = await Promise.all([
    clientAssessmentProgress(ctx, ctx.actor.clientId!),
    clientMonitoring(ctx, ctx.actor.clientId!),
  ]);
  const a = m.adherence28;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Tu progreso</h1>
      <section className="rounded-xl border border-border p-5" aria-label="Tu constancia">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Tu constancia</h2>
        {a.planned ? (
          <>
            <p className="mt-2 text-lg font-medium">
              Has hecho {a.done} de {a.planned} sesiones en las últimas 4 semanas (
              {a.percent!.toLocaleString('es-ES')} %).
            </p>
            <ul className="mt-3 flex items-end gap-2" aria-label="Sesiones por semana">
              {m.weeks.slice(-4).map((w) => (
                <li key={w.weekStart} className="flex flex-1 flex-col items-center gap-1 text-xs">
                  <span className="tabular-nums">
                    {w.adherence.planned ? `${w.adherence.done}/${w.adherence.planned}` : '—'}
                  </span>
                  {w.adherence.planned ? (
                    <span
                      className="w-full rounded-t bg-accent"
                      style={{
                        height: `${Math.max(2, ((w.adherence.percent ?? 0) / 100) * 48)}px`,
                      }}
                      aria-hidden
                    />
                  ) : null}
                  <span className="text-muted">
                    {new Intl.DateTimeFormat('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'UTC',
                    }).format(new Date(`${w.weekStart}T00:00:00Z`))}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Cuando tengas sesiones publicadas verás aquí cuántas has hecho.
          </p>
        )}
      </section>
      <p className="text-sm text-muted">
        Comparamos cada resultado con el margen de error del test: así sabemos si un cambio es real.
      </p>
      <ProgressView data={data} audience="client" />
    </div>
  );
}
