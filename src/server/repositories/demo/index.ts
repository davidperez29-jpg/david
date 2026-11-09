import 'server-only';
import { type IsoDate } from '@/domain/time';
import { type DateRange, type Repositories, type TrainingRepository } from '../ports';
import { type DemoDataset } from './dataset';

const inRange = (date: IsoDate, range: DateRange) => date >= range.from && date <= range.to;

/** Copia profunda: quien consume los datos nunca puede modificar el conjunto en memoria. */
const clone = <T>(value: T): T => structuredClone(value);

const readOnly = (): never => {
  throw new Error(
    'El almacén en memoria es solo la referencia de las pruebas de equivalencia: la prescripción v2 vive en SQLite.',
  );
};

/** Sin prescripción v2: cualquier uso es un error de programación (la aplicación usa SQLite). */
const noTraining: TrainingRepository = {
  getSession: readOnly,
  listSessions: readOnly,
  createDraft: readOnly,
  saveDraft: readOnly,
  swapDraftOrder: readOnly,
  deleteDraft: readOnly,
  startChangeDraft: readOnly,
  discardChangeDraft: readOnly,
  publish: readOnly,
  getVersion: readOnly,
  listVersions: readOnly,
  getExecution: readOnly,
};

/**
 * Repositorios en memoria sobre el conjunto de demostración de la Fase 1.
 * Desde V1 la aplicación usa SQLite (`../sqlite`); este adaptador queda como referencia de la
 * prueba de equivalencia de la capa de compatibilidad (las pantallas existentes deben verse
 * igual con los dos) y como fuente de los datos de referencia de solo lectura.
 */
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
    library: {
      customTagCategories: async () => clone(data.library.tagCategories),
      customTags: async () => clone(data.library.tags),
      personalTagging: async (trainerId) =>
        clone(
          data.library.personalTagging
            .filter((t) => t.trainerId === trainerId)
            .map(({ variantId, tagId }) => ({ variantId, tagId })),
        ),
      exercises: async () => clone(data.library.exercises),
      variants: async () => clone(data.library.variants),
      getVariants: async (ids) => clone(data.library.variants.filter((v) => ids.includes(v.id))),
      primaryVariants: async (exerciseIds) =>
        clone(
          data.library.variants.filter((v) => v.isPrimary && exerciseIds.includes(v.exerciseId)),
        ),
      progressions: async () => clone(data.library.progressions),
      notes: async (trainerId) =>
        clone(data.library.notes.filter((n) => n.trainerId === trainerId)),
      favorites: async (trainerId) =>
        clone(data.library.favorites.filter((f) => f.trainerId === trainerId)),
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
    goals: {
      listByClient: async (clientId) => clone(data.goals.filter((g) => g.clientId === clientId)),
    },
    rehab: {
      listByClient: async (clientId) => clone(data.rehab.filter((r) => r.clientId === clientId)),
    },
    sharing: {
      getForClient: async (clientId) =>
        clone(data.sharing.find((s) => s.clientId === clientId) ?? null),
    },
    training: noTraining,
  };
}
