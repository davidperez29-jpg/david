import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { type AssessmentSeriesVM } from '@/contracts/shared';
import { formatDate, formatNumber } from '@/domain/format';
import { Badge } from '@/ui/badge';
import { OriginBadge, ProvenanceDetails } from './provenance';

function ChangeBadge({ series }: { series: AssessmentSeriesVM }) {
  const comparison = series.comparison;
  if (!comparison) return null;
  if (!comparison.comparable) {
    return <Badge tone="outline">No comparable: {comparison.reason}</Badge>;
  }
  const sign = comparison.absolute > 0 ? '+' : '';
  const text = `${sign}${formatNumber(comparison.absolute, 2)} ${series.unit ?? ''} (${sign}${formatNumber(comparison.percent, 1)} %)`;
  const Icon =
    comparison.absolute > 0 ? TrendingUp : comparison.absolute < 0 ? TrendingDown : Minus;
  return (
    <Badge
      tone={comparison.improved === null ? 'neutral' : comparison.improved ? 'leaf' : 'coral'}
      icon={<Icon />}
      title={
        series.betterWhen === 'lower'
          ? 'En esta prueba, un valor menor es mejor.'
          : 'En esta prueba, un valor mayor es mejor.'
      }
    >
      {text}
    </Badge>
  );
}

/** Resultados de evaluación con su procedencia; el cambio solo se calcula si es comparable. */
export function AssessmentSeriesList({
  series,
  compact = false,
}: {
  series: AssessmentSeriesVM[];
  compact?: boolean;
}) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {series.map((item) => {
        const last = item.points.at(-1);
        return (
          <li
            key={item.testId}
            className="rounded-3xl border border-line/70 bg-white p-5 shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold leading-snug text-ink-900">{item.testName}</h3>
                <p className="text-sm text-ink-500">{item.outcomeName}</p>
              </div>
              {last ? <OriginBadge origin={last.provenance.origin} /> : null}
            </div>
            {last ? (
              <p className="mt-3 font-display text-3xl font-bold text-ink-900 tabular-nums">
                {formatNumber(last.value, 2)}{' '}
                <span className="text-lg font-semibold text-ink-500">{item.unit}</span>
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <ChangeBadge series={item} />
            </div>
            <ol className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
              {[...item.points].reverse().map((point) => (
                <li key={point.date} className="tabular-nums">
                  <span className="flex justify-between gap-3">
                    <span className="text-ink-500">{formatDate(point.date, 'dayMonth')}</span>
                    <span className="font-semibold text-ink-900">
                      {formatNumber(point.value, 2)} {item.unit}
                    </span>
                  </span>
                  {point.attempts ? (
                    <span className="block text-right text-xs text-ink-500">
                      {point.aggregationLabel} de {point.attempts.length}:{' '}
                      {point.attempts.map((attempt) => formatNumber(attempt, 2)).join(' · ')}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            {!compact && last ? (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold text-sun-700 hover:text-ink-900">
                  ¿De dónde sale este dato?
                </summary>
                <div className="mt-2 rounded-2xl bg-cream-50 p-3">
                  <ProvenanceDetails provenance={last.provenance} />
                </div>
              </details>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
