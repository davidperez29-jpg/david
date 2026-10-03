/**
 * Attempt aggregation (§11.2). The same rule must be applied to every assessment of a series,
 * otherwise comparisons are not valid.
 */
export type Aggregation = 'best' | 'mean' | 'mean_of_best_n' | 'last';
export type BetterDirection = 'higher' | 'lower' | 'target_range';

export interface Aggregated {
  /** Value used for comparisons, following the test's rule. */
  value: number;
  best: number;
  mean: number;
  /** Within-session coefficient of variation of the attempts (%), null with < 2 attempts. */
  cvIntraPercent: number | null;
}

const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Sample standard deviation (n − 1). */
export function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export function aggregateAttempts(
  attempts: number[],
  rule: { aggregation: Aggregation; n?: number | null; betterDirection: BetterDirection },
): Aggregated {
  const xs = attempts.filter((x) => Number.isFinite(x));
  if (!xs.length) throw new Error('No hay intentos válidos.');
  const sorted = [...xs].sort((a, b) => (rule.betterDirection === 'lower' ? a - b : b - a));
  const best = sorted[0]!;
  const m = mean(xs);
  let value: number;
  switch (rule.aggregation) {
    case 'best':
      value = best;
      break;
    case 'mean':
      value = m;
      break;
    case 'mean_of_best_n':
      value = mean(sorted.slice(0, Math.max(1, Math.min(rule.n ?? 2, sorted.length))));
      break;
    case 'last':
      value = xs[xs.length - 1]!;
      break;
  }
  const cv = xs.length >= 2 && m !== 0 ? (sd(xs) / Math.abs(m)) * 100 : null;
  return {
    value: round(value),
    best: round(best),
    mean: round(m),
    cvIntraPercent: cv == null ? null : round(cv, 2),
  };
}

export function aggregationLabel(a: Aggregation, n?: number | null): string {
  return {
    best: 'mejor intento',
    mean: 'media de los intentos',
    mean_of_best_n: `media de los ${n ?? 2} mejores`,
    last: 'último intento',
  }[a];
}
