import type { Prescription } from '@tp/domain';
import { api, type ApiError } from '@/lib/api-client';

/**
 * Where the session table saves (restructure phase 3, decision A19): the same table edits a
 * client's session (row by row through the API, with each row's version) and a template's
 * session (the whole template, with the template's version). The table only talks to this.
 */
export interface RowChange {
  prescription?: Partial<Record<keyof Prescription, unknown>>;
  notesForClient?: string | null;
  exerciseId?: string;
  /** Name of `exerciseId`, for stores that keep the table locally (not sent to the API). */
  exerciseName?: string;
}
export interface NewRow {
  exerciseId: string;
  exerciseName?: string;
  prescription: Prescription;
  notesForClient?: string | null;
}
export type StoreResult<T = object> =
  | ({ ok: true } & T)
  | {
      ok: false;
      /** Someone else changed it meanwhile: nothing was saved. */
      conflict?: boolean;
      message: string;
      details?: Record<string, string[]>;
    };

export interface GridStore {
  saveRow(row: { id: string; version: number }, change: RowChange): Promise<StoreResult>;
  addRows(rows: NewRow[]): Promise<StoreResult<{ ids: string[] }>>;
  duplicateRows(ids: string[]): Promise<StoreResult<{ ids: string[] }>>;
  deleteRows(ids: string[]): Promise<StoreResult>;
  moveRow(id: string, direction: 'up' | 'down'): Promise<StoreResult>;
  /** Show the saved data (reload from the server, or nothing when the state is local). */
  refresh(): void;
}

const fail = (e: ApiError): StoreResult<never> => ({
  ok: false,
  conflict: e.code === 'conflict',
  message: e.message,
  details: e.details ?? undefined,
});

/** A client's session: each row is saved on its own with its version (optimistic locking). */
export function planGridStore(sessionId: string, refresh: () => void): GridStore {
  const versions = new Map<string, number>();
  return {
    async saveRow(row, { exerciseName: _n, ...change }) {
      void _n;
      const version = Math.max(versions.get(row.id) ?? 0, row.version);
      const res = await api(`/session-exercises/${row.id}`, {
        method: 'PATCH',
        body: { expectedVersion: version, ...change },
      });
      if (res.ok) {
        versions.set(row.id, version + 1);
        return { ok: true };
      }
      if (res.error.code === 'conflict') versions.delete(row.id);
      return fail(res.error);
    },
    async addRows(rows) {
      const res = await api<{ ids: string[] }>(`/plan-sessions/${sessionId}/exercises`, {
        method: 'POST',
        body: { rows: rows.map(({ exerciseName: _n, ...r }) => (void _n, r)) },
      });
      return res.ok ? { ok: true, ids: res.data.ids } : fail(res.error);
    },
    async duplicateRows(ids) {
      const res = await api<{ ids: string[] }>('/session-exercises/duplicate', {
        method: 'POST',
        body: { ids },
      });
      return res.ok ? { ok: true, ids: res.data.ids } : fail(res.error);
    },
    async deleteRows(ids) {
      const res = await api('/session-exercises/delete', { method: 'POST', body: { ids } });
      return res.ok ? { ok: true } : fail(res.error);
    },
    async moveRow(id, direction) {
      const res = await api(`/session-exercises/${id}/move`, {
        method: 'POST',
        body: { direction },
      });
      return res.ok ? { ok: true } : fail(res.error);
    },
    refresh,
  };
}

/** Applies a cell change to a prescription: null removes the value. */
export function applyPrescription(
  base: Prescription,
  patch: Partial<Record<keyof Prescription, unknown>>,
): Prescription {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) delete out[k];
    else out[k] = v;
  }
  return out as Prescription;
}
