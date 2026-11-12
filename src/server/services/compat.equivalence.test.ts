import { describe, expect, it } from 'vitest';
import { type ClientActor, type TrainerActor } from '@/domain/access';
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
          const result = await both((repos) => view(client(repos, id)));
          expect(result.sqlite, `${view.name} · ${id}`).toEqual(result.memory);
        }
      }
    });
  });
}
