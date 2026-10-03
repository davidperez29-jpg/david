import type { AssessmentProgress } from '@tp/application';
import { Identifiers } from '@/components/science/evidence';
import { Badge, Card, EmptyState } from '@/components/ui/card';
import { formatValue, label } from '@/lib/labels';
import { BeforeAfterBars, SeriesChart } from './charts';
import { ChangeLine, VerdictBadge } from './verdict';

/** Plain-language verdicts for the client app: never numbers without meaning. */
const CLIENT_TEXT: Record<string, string> = {
  probable_improvement: 'Has mejorado: el cambio supera el margen de error del test.',
  probable_decline: 'Ha bajado más que el margen de error. Lo comentaremos.',
  probable_change: 'Ha cambiado más que el margen de error.',
  possible_change:
    'Hay un cambio, pero está cerca del margen de error: lo confirmaremos en la próxima evaluación.',
  within_error: 'Sin cambios más allá del margen de error del test.',
  unknown_error: 'Mostramos la diferencia; este test no tiene un margen de error conocido.',
};

export function ProgressView({
  data,
  audience,
}: {
  data: AssessmentProgress;
  audience: 'trainer' | 'client';
}) {
  if (data.series.length === 0) {
    return <EmptyState>Todavía no hay resultados registrados.</EmptyState>;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.series.map((s) => {
        const first = s.points[0]!;
        const last = s.points[s.points.length - 1]!;
        const title = `${s.test.name}${s.side !== 'both' ? ` · ${label('side', s.side)}` : ''}`;
        return (
          <Card key={`${s.test.id}-${s.side}`} title={title}>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-lg font-semibold tabular-nums">
                  {formatValue(last.value)} {s.test.unit}
                </span>
                {s.test.isEstimate ? <Badge tone="warn">Estimación</Badge> : null}
                {s.points.length >= 3 ? (
                  <span className="text-xs text-muted">Tendencia {label('trend', s.trend)}</span>
                ) : null}
              </div>
              {s.points.length >= 2 ? (
                <>
                  {s.points.length >= 3 ? (
                    <SeriesChart
                      points={s.points}
                      unit={s.test.unit}
                      errorBand={s.overall?.error?.te ?? null}
                      label={title}
                    />
                  ) : (
                    <BeforeAfterBars before={first} after={last} unit={s.test.unit} label={title} />
                  )}
                  {s.overall ? (
                    audience === 'trainer' ? (
                      <div>
                        <p className="text-xs text-muted">Desde la primera evaluación:</p>
                        <ChangeLine change={s.overall} unit={s.test.unit} />
                      </div>
                    ) : (
                      <p className="text-sm">{CLIENT_TEXT[s.overall.verdict]}</p>
                    )
                  ) : null}
                  {audience === 'trainer' && s.lastStep ? (
                    <div>
                      <p className="text-xs text-muted">Respecto a la evaluación anterior:</p>
                      <ChangeLine change={s.lastStep} unit={s.test.unit} />
                    </div>
                  ) : null}
                  {s.note ? <p className="text-xs text-warn">{s.note}</p> : null}
                </>
              ) : (
                <p className="text-xs text-muted">
                  Una sola medición: el cambio se verá en la próxima evaluación.
                </p>
              )}
              {audience === 'trainer' && s.references.length ? (
                <ul className="flex flex-col gap-1 border-t border-border pt-2 text-xs">
                  {s.references.map((r) => (
                    <li key={r.referenceId}>
                      {r.applicable ? (
                        <>
                          <span>{r.summary}</span>
                          {r.zScore != null ? (
                            <span className="tabular-nums"> · z = {r.zScore}</span>
                          ) : null}
                          {r.band ? <span> · {r.band}</span> : null}
                        </>
                      ) : (
                        <span className="text-muted">
                          Referencia de población distinta ({r.population}): no comparable —{' '}
                          {r.reasons.join('; ')}.
                        </span>
                      )}{' '}
                      <span className="text-muted">
                        {r.source} <Identifiers doi={r.doi} pmid={r.pmid} />
                      </span>
                      {r.flag ? <p className="font-medium text-danger">{r.flag.message}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Card>
        );
      })}
      {audience === 'trainer'
        ? data.derived.map((d) => (
            <Card key={d.metric} title={d.name}>
              <p className="text-lg font-semibold tabular-nums">
                {formatValue(d.points[d.points.length - 1]!.value)} {d.unit}
              </p>
              <p className="text-xs text-muted">{d.definition}</p>
              {d.overall ? (
                <div className="mt-2">
                  <ChangeLine change={d.overall} unit={d.unit} />
                </div>
              ) : null}
            </Card>
          ))
        : null}
    </div>
  );
}

export { VerdictBadge };
