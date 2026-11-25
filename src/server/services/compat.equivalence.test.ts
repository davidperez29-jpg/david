import { describe, expect, it } from 'vitest';
import { type ClientActor, type TrainerActor } from '@/domain/access';
import { PHASE1_VOLUME_FORMULAS } from '@/domain/analysis/period';
import { addDays, type IsoDate, startOfIsoWeek } from '@/domain/time';
import { weeklyVolume } from '@/domain/training/volume';
import { type ClientContext, type TrainerContext } from '../context';
import { seededTestDatabase } from '../db/test-support';
import { createDemoRepositories } from '../repositories/demo';
import { buildDemoDataset, DEMO_TRAINER_ID } from '../repositories/demo/dataset';
import { type Repositories } from '../repositories/ports';
import { getClientProgress, getClientWeek } from './client';
import {
  getClientEvaluations,
  getClientGoals,
  getClientHealth,
  getClientPlan,
  getClientProfile,
  getClientResults,
  getClientTrainingLog,
} from './client-file';
import { getLibrary } from './library';
import { loggedSets } from './mappers';
import { sessionsAndLogs } from './trainer-access';
import {
  getAssessmentsOverview,
  getLoadOverview,
  getPlanningOverview,
  getRehabOverview,
  getTrainerDashboard,
  listTrainerClients,
} from './trainer';

/**
 * B1-09 · Equivalencia de la capa de compatibilidad (docs/V1_SPEC.md §9, riesgo principal):
 * las pantallas existentes deben ver EXACTAMENTE lo mismo con el almacén en memoria de la
 * Fase 1 que con SQLite (sesiones sembradas como versión 1 y registros como `set_log`).
 * Se comparan todos los modelos de vista de los casos de uso existentes, para cada cliente,
 * en un miércoles, un lunes y un domingo (los límites de la semana).
 */
const TIME_ZONE = 'Europe/Madrid';

/**
 * P-106 (B3.2): «Carga», «Resultados» y «Progreso» ya no usan la capa de compatibilidad sino el
 * análisis v2 (fecha de ejecución, tonelaje 2.0.0, cada serie frente a su versión), que el almacén
 * en memoria no puede servir. Para ellas se comprueba AC-B3-21: con los datos actuales, sus cifras
 * son las mismas que daba el cálculo de la Fase 1 sobre el almacén en memoria. El resto de cada
 * modelo de vista se sigue comparando con el almacén en memoria (repositorio híbrido: solo
 * `training` viene de SQLite).
 */
type Range = { from: IsoDate; to: IsoDate };

/** Cálculo anterior a P-106 de «Carga» y «Resultados»: por fecha prevista, tonelaje 1.0.0. */
async function phase1ByPlannedDate(ctx: TrainerContext, clientId: string, range: Range) {
  const { sessions, logs } = await sessionsAndLogs(ctx, clientId, range);
  return weeklyVolume(
    sessions.flatMap((s) => {
      const log = logs.get(s.id);
      return log ? [{ date: s.date, sets: loggedSets(s, log) }] : [];
    }),
    range,
  );
}

/** Cálculo anterior a P-106 de «Progreso»: por la fecha del registro, tonelaje 1.0.0. */
async function phase1ByLogDate(repos: Repositories, clientId: string, range: Range) {
  const [sessions, logs] = await Promise.all([
    repos.sessions.listByClient(clientId, range),
    repos.logs.listByClient(clientId, range),
  ]);
  const byId = new Map(sessions.map((s) => [s.id, s]));
  return weeklyVolume(
    logs.flatMap((log) => {
      const session = byId.get(log.sessionId);
      return session ? [{ date: log.date, sets: loggedSets(session, log) }] : [];
    }),
    range,
  );
}

const P106 = new Set<unknown>([getLoadOverview, getClientResults, getClientProgress]);

/**
 * Única diferencia admitida (P-84, documentada): en la Fase 1 una serie NO realizada guardaba
 * repeticiones y carga (las previstas); en V1 una serie no realizada no tiene ni una ni otra
 * (`CHECK` de `set_log`). La pantalla de Registro solo muestra «no» para esas series, así que se
 * comparan sin esos dos valores.
 */
type LogSet = { completed: boolean; reps?: unknown; loadKg?: unknown };
const withoutUnperformedValues = <T>(entries: T): T =>
  JSON.parse(
    JSON.stringify(entries, (key, value: unknown) => {
      if (key === 'sets' && Array.isArray(value)) {
        return (value as LogSet[]).map((set) =>
          set.completed === false ? { ...set, reps: null, loadKg: null } : set,
        );
      }
      return value;
    }),
  ) as T;

for (const today of ['2026-11-04', '2026-11-09', '2026-11-15']) {
  describe(`equivalencia memoria ↔ SQLite (${today})`, () => {
    const data = buildDemoDataset(today);
    const memory = createDemoRepositories(data);
    const { repos: sqlite } = seededTestDatabase(today, { timeZone: TIME_ZONE });

    const trainer = (repos: Repositories): TrainerContext => ({
      actor: { role: 'trainer', trainerId: DEMO_TRAINER_ID } satisfies TrainerActor,
      today,
      timeZone: TIME_ZONE,
      repos,
    });
    const client = (repos: Repositories, clientId: string): ClientContext => ({
      actor: { role: 'client', clientId, trainerId: DEMO_TRAINER_ID } satisfies ClientActor,
      today,
      timeZone: TIME_ZONE,
      repos,
    });
    const both = async <T>(run: (repos: Repositories) => Promise<T>) => ({
      memory: await run(memory),
      sqlite: await run(sqlite),
    });
    /** Para las vistas de P-106: todo del almacén en memoria salvo `training` (SQLite). */
    const hybrid: Repositories = { ...memory, training: sqlite.training };
    const range: Range = { from: startOfIsoWeek(addDays(today, -21)), to: today };

    it('vistas generales del entrenador', async () => {
      for (const view of [
        listTrainerClients,
        getTrainerDashboard,
        getPlanningOverview,
        getLoadOverview,
        getAssessmentsOverview,
        getRehabOverview,
        getLibrary,
      ] as ((ctx: TrainerContext) => Promise<unknown>)[]) {
        if (P106.has(view)) continue;
        const result = await both((repos) => view(trainer(repos)));
        expect(result.sqlite, view.name).toEqual(result.memory);
      }
    });

    it('cada pestaña de la ficha de cada cliente', async () => {
      for (const { id } of data.clients) {
        for (const view of [
          getClientProfile,
          getClientGoals,
          getClientPlan,
          getClientTrainingLog,
          getClientEvaluations,
          getClientResults,
          getClientHealth,
        ] as ((ctx: TrainerContext, clientId: string) => Promise<unknown>)[]) {
          if (P106.has(view)) continue;
          const result = await both((repos) => view(trainer(repos), id));
          const normalize =
            view === getClientTrainingLog ? withoutUnperformedValues : <T>(v: T) => v;
          expect(normalize(result.sqlite), `${view.name} · ${id}`).toEqual(
            normalize(result.memory),
          );
        }
      }
    });

    it('la app de cada cliente: Semana y Progreso', async () => {
      for (const { id } of data.clients) {
        for (const view of [getClientWeek, getClientProgress] as ((
          ctx: ClientContext,
        ) => Promise<unknown>)[]) {
          if (P106.has(view)) continue;
          const result = await both((repos) => view(client(repos, id)));
          expect(result.sqlite, `${view.name} · ${id}`).toEqual(result.memory);
        }
      }
    });

    it('AC-B3-21 · «Carga»: fecha de ejecución y tonelaje 2.0.0, con las mismas cifras que la Fase 1', async () => {
      const actual = await getLoadOverview(trainer(sqlite));
      const reference = await getLoadOverview(trainer(hybrid));
      const expected = {
        ...reference,
        clients: await Promise.all(
          reference.clients.map(async (c) => ({
            ...c,
            weeks: await phase1ByPlannedDate(trainer(memory), c.id, reference.range),
          })),
        ),
      };
      expect(actual).toEqual(expected);
      expect(actual.clients.some((c) => c.weeks.some((w) => w.volumeLoadKg > 0))).toBe(true);
      expect(actual.formulas.map((f) => `${f.id} ${f.version}`).sort()).toEqual(
        Object.values(PHASE1_VOLUME_FORMULAS)
          .map((f) => `${f.id} ${f.version}`)
          .sort(),
      );
    });

    it('AC-B3-21 · «Resultados» de cada cliente: las mismas cifras que la Fase 1', async () => {
      for (const { id } of data.clients) {
        const actual = await getClientResults(trainer(sqlite), id);
        const reference = await getClientResults(trainer(hybrid), id);
        expect(actual, id).toEqual({
          ...reference!,
          weeklyVolume: await phase1ByPlannedDate(trainer(memory), id, range),
        });
      }
    });

    it('AC-B3-21 · «Progreso» de cada clienta: las mismas cifras que la Fase 1', async () => {
      let shown = 0;
      for (const { id } of data.clients) {
        const actual = await getClientProgress(client(sqlite, id));
        const reference = await getClientProgress(client(hybrid, id));
        expect(actual, id).toEqual({
          ...reference,
          volume: reference.volume === null ? null : await phase1ByLogDate(memory, id, range),
        });
        if (actual.volume?.some((w) => w.completedSets > 0)) shown += 1;
      }
      expect(shown).toBeGreaterThan(0);
    });
  });
}
