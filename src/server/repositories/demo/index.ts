import 'server-only';
import { type IsoDate } from '@/domain/time';
import { type DateRange, type Repositories } from '../ports';
import { buildDemoDataset, type DemoDataset } from './dataset';

const inRange = (date: IsoDate, range: DateRange) => date >= range.from && date <= range.to;

/** Copia profunda: quien consume los datos nunca puede modificar el conjunto en memoria. */
const clone = <T>(value: T): T => structuredClone(value);

export function createDemoRepositories(data: DemoDataset): Repositories {
  return {
    trainers: {
      getById: async (id) => clone(data.trainers.find((t) => t.id === id) ?? null),
    },
    clients: {
      listByTrainer: async (trainerId) =>
        clone(data.clients.filter((c) => c.trainerId === trainerId)),
      getById: async (id) => clone(data.clients.find((c) => c.id === id) ?? null),
    },
    exercises: {
      list: async () => clone(data.exercises),
      getById: async (id) => clone(data.exercises.find((e) => e.id === id) ?? null),
      getMany: async (ids) => clone(data.exercises.filter((e) => ids.includes(e.id))),
    },
    sessions: {
      listByClient: async (clientId, range) =>
        clone(data.sessions.filter((s) => s.clientId === clientId && inRange(s.date, range))),
      getById: async (id) => clone(data.sessions.find((s) => s.id === id) ?? null),
    },
    logs: {
      listByClient: async (clientId, range) =>
        clone(data.logs.filter((l) => l.clientId === clientId && inRange(l.date, range))),
    },
    assessments: {
      listByClient: async (clientId) =>
        clone(data.assessments.filter((a) => a.clientId === clientId)),
    },
    rehab: {
      listByClient: async (clientId) => clone(data.rehab.filter((r) => r.clientId === clientId)),
    },
    sharing: {
      getForClient: async (clientId) =>
        clone(data.sharing.find((s) => s.clientId === clientId) ?? null),
    },
  };
}

/** El conjunto de demostración se regenera una vez al día (depende de la fecha de hoy). */
let cached: { today: IsoDate; repositories: Repositories } | null = null;

export function getDemoRepositories(today: IsoDate): Repositories {
  if (cached?.today !== today) {
    cached = { today, repositories: createDemoRepositories(buildDemoDataset(today)) };
  }
  return cached.repositories;
}
