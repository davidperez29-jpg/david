import 'server-only';
import { type Perspective, startVersionObserved } from '@/domain/analysis/reference';
import { analyzeSession, type SessionAnalysis } from '@/domain/analysis/session';
import { addDays, type IsoDate, localDateOf } from '@/domain/time';
import { type TrainingSession } from '@/domain/training/session-v2';
import { type Repositories } from '../repositories/ports';

/**
 * Lectura común del análisis (B3.1 y B3.2): carga lo guardado de una sesión y la analiza con el
 * dominio. La usan A8, A9, A10, los totales del día y las vistas corregidas de la Fase 1, para que
 * todas den las mismas cifras. **No decide permisos:** lo hace cada caso de uso antes de llamarla.
 */
export interface AnalysisClock {
  today: IsoDate;
  /** Zona de la aplicación. */
  timeZone: string;
  now?: string;
}

export type StartFacts = Awaited<ReturnType<Repositories['training']['startVersionFacts']>>;

const anyName = (_variantId: string, fallback?: string) => fallback ?? 'Ejercicio';

/** Análisis de una sesión publicada (`null` si es un borrador). */
export async function analyzeStoredSession(
  repos: Repositories,
  session: TrainingSession,
  options: {
    perspective: Perspective;
    clock: AnalysisClock;
    facts: StartFacts;
    names?: (variantId: string, fallback?: string) => string;
    includeVariant?: (variantId: string) => boolean;
  },
): Promise<SessionAnalysis | null> {
  if (session.status !== 'published' || session.currentVersion === null) return null;
  const [versions, execution] = await Promise.all([
    repos.training.listVersions(session.id),
    repos.training.getExecution(session.id),
  ]);
  const startObserved = execution
    ? startVersionObserved({ startReceivedAt: execution.log.startReceivedAt, ...options.facts })
    : true;
  return analyzeSession({
    perspective: options.perspective,
    versions,
    currentVersion: session.currentVersion,
    execution,
    startObserved,
    today: options.clock.today,
    timeZone: options.clock.timeZone,
    now: options.clock.now ?? new Date().toISOString(),
    exerciseName: options.names ?? anyName,
    ...(options.includeVariant ? { includeVariant: options.includeVariant } : {}),
  });
}

/**
 * Ejecuciones de un cliente con fecha de ejecución entre `from` y `to` (fechas locales, en la
 * zona del móvil de cada inicio). Se pide un margen de dos días en UTC y se filtra después: las
 * zonas van de UTC−12 a UTC+14.
 */
export async function executionsOn(
  repos: Repositories,
  clientId: string,
  from: IsoDate,
  to: IsoDate,
) {
  const rows = await repos.training.listExecutionsStartedBetween(
    clientId,
    `${addDays(from, -2)}T00:00:00.000Z`,
    `${addDays(to, 3)}T00:00:00.000Z`,
  );
  return rows
    .map((r) => ({ ...r, executedOn: localDateOf(r.startedAt, r.startTimeZone) }))
    .filter((r) => r.executedOn >= from && r.executedOn <= to);
}

/**
 * Lo ejecutado por un cliente en un rango, sesión a sesión (por fecha de ejecución). Para las
 * vistas de la Fase 1 (P-106). El llamante ya ha comprobado que puede leerlo.
 */
export async function executedEntries(
  repos: Repositories,
  clientId: string,
  range: { from: IsoDate; to: IsoDate },
  clock: AnalysisClock,
) {
  const facts = await repos.training.startVersionFacts();
  const out: { executedOn: IsoDate; analysis: SessionAnalysis }[] = [];
  for (const row of await executionsOn(repos, clientId, range.from, range.to)) {
    const session = await repos.training.getSession(row.sessionId);
    if (!session || session.clientId !== clientId) continue;
    const analysis = await analyzeStoredSession(repos, session, {
      perspective: 'original',
      clock,
      facts,
    });
    if (analysis) out.push({ executedOn: row.executedOn, analysis });
  }
  return out;
}
