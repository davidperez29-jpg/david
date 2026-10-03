import Link from 'next/link';
import { getPlanTemplate } from '@tp/application';
import { DomainError } from '@tp/domain';
import { notFound } from 'next/navigation';
import { Badge, Card } from '@/components/ui/card';
import { label } from '@/lib/labels';
import { requireStaff } from '@/server/session';

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const ctx = await requireStaff();
  const { templateId } = await params;
  const t = await getPlanTemplate(ctx, templateId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') notFound();
    throw e;
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/app/plans" className="text-sm text-muted hover:underline">
          ← Plantillas
        </Link>
        <h1 className="text-2xl font-semibold">{t.name}</h1>
        {t.isGlobal ? <Badge tone="accent">Plataforma</Badge> : <Badge>Propia</Badge>}
      </div>
      {t.description ? <p className="text-sm text-muted">{t.description}</p> : null}
      <Card title="Estructura">
        <p className="mb-2 text-sm">
          {t.totalWeeks} semanas · {t.sessionsPerWeek} sesiones/semana · {t.durationMonths} meses
        </p>
        <ul className="flex flex-col gap-2 text-sm">
          {t.phases.map((p) => (
            <li key={p.name}>
              <span className="font-medium">{p.name}</span> (semanas {p.startWeek}–{p.endWeek})
              {p.objective ? ` · ${p.objective}` : ''}
              <ul className="ml-4 list-disc text-muted">
                {p.mesocycles.map((m) => (
                  <li key={m.name}>
                    {m.name}
                    {m.focus ? ` · ${m.focus}` : ''}:{' '}
                    {m.weekTypes.map((w) => label('weekType', w)).join(' → ')}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Card>
      {t.methods.length ? (
        <Card title="Evidencia de las dosis">
          <ul className="flex flex-wrap gap-3 text-sm">
            {t.methods.map((m) => (
              <li key={m.id}>
                <Link href={`/app/science/methods/${m.id}`} className="text-accent underline">
                  {m.name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {t.sessions.map((s) => (
          <Card key={s.dayLabel} title={`${s.dayLabel} · ${s.title}`}>
            {s.objective ? <p className="mb-2 text-xs text-muted">{s.objective}</p> : null}
            {s.blocks.map((b, i) => (
              <div key={i} className="mb-2">
                <p className="text-xs font-semibold text-muted uppercase">
                  {b.label ?? label('blockType', b.type)}
                </p>
                <ul className="text-sm">
                  {b.exercises.map((e, j) => (
                    <li key={j}>
                      {e.name} <span className="text-muted">· {e.short}</span>
                      {e.progression !== 'none' ? (
                        <span className="text-xs text-accent"> · progresión: {e.progression}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
