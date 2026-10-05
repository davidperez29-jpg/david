'use client';

import type { PlanTemplateDetail } from '@tp/application';
import type { TemplateDefinition, TemplateSession } from '@tp/domain';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyPrescription,
  type GridStore,
  type StoreResult,
} from '@/components/sessions/grid-store';
import { SessionGrid, type GridBlock } from '@/components/sessions/session-grid';
import { api } from '@/lib/api-client';
import { label } from '@/lib/labels';

type Where = { phase: number | null; session: number };
type Names = Record<string, { id: string; name: string }>;

const clone = <T,>(v: T): T => structuredClone(v);
const namesOf = (list: PlanTemplateDetail['exercises']): Names =>
  Object.fromEntries(list.map((e) => [e.ref, { id: e.id, name: e.name }]));
const newId = () => crypto.randomUUID();

/** Sessions shown for the chosen pattern: the template's or a phase's own. */
function sessionsOf(def: TemplateDefinition, phase: number | null): TemplateSession[] {
  return phase === null ? def.sessions : (def.phases[phase]?.sessions ?? def.sessions);
}

/**
 * The template's weekly sessions in the same table as a client's session (decision A19). Each
 * change saves the whole template with its version: if someone else saved it meanwhile, nothing
 * is overwritten and the page reloads their version. Global templates are shown read-only.
 */
export function TemplateEditor({ t }: { t: PlanTemplateDetail }) {
  const router = useRouter();
  const [def, setDef] = useState<TemplateDefinition>(t.definition);
  const [names, setNames] = useState<Names>(() => namesOf(t.exercises));
  const [templateVersion, setTemplateVersion] = useState(t.templateVersion);
  const [where, setWhere] = useState<Where>({ phase: null, session: 0 });
  const latest = useRef({ def: t.definition, version: t.version });
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  // A newer version from the server (restored, or saved by someone else) replaces the local one.
  useEffect(() => {
    if (t.version > latest.current.version) {
      latest.current = { def: t.definition, version: t.version };
      setDef(t.definition);
      setNames(namesOf(t.exercises));
      setTemplateVersion(t.templateVersion);
    }
  }, [t]);

  const phasesWithSessions = def.phases
    .map((p, i) => ({ name: p.name, i, own: !!p.sessions }))
    .filter((p) => p.own);
  const sessions = sessionsOf(def, where.phase);
  const current = sessions[Math.min(where.session, sessions.length - 1)];

  /** Applies a change to the session shown and saves the template (one save at a time). */
  const commit = <T extends object = object>(
    change: (s: TemplateSession) => T | { error: string },
    named: Names = {},
  ): Promise<StoreResult<T>> => {
    const run = async (): Promise<StoreResult<T>> => {
      const next = clone(latest.current.def);
      const list = sessionsOf(next, where.phase);
      const s = list[Math.min(where.session, list.length - 1)];
      if (!s) return { ok: false, message: 'Sesión no encontrada.' };
      const r = change(s);
      if ('error' in r) return { ok: false, message: r.error };
      const res = await api<{ version: number; templateVersion: number }>(
        `/plan-templates/${t.id}`,
        { method: 'PATCH', body: { expectedVersion: latest.current.version, definition: next } },
      );
      if (!res.ok) {
        if (res.error.code === 'conflict') router.refresh();
        return {
          ok: false,
          conflict: res.error.code === 'conflict',
          message: res.error.message,
          details: res.error.details ?? undefined,
        };
      }
      latest.current = { def: next, version: res.data.version };
      setDef(next);
      setNames((n) => ({ ...n, ...named }));
      setTemplateVersion(res.data.templateVersion);
      return { ok: true, ...r };
    };
    const p = queue.current.then(run, run);
    queue.current = p;
    return p;
  };

  const store: GridStore = {
    saveRow: (row, change) =>
      commit(
        (s) => {
          const e = s.blocks.flatMap((b) => b.exercises).find((x) => x.id === row.id);
          if (!e) return { error: 'Esa fila ya no existe.' };
          if (change.prescription)
            e.prescription = applyPrescription(e.prescription, change.prescription);
          if (change.notesForClient !== undefined)
            if (change.notesForClient) e.notesForClient = change.notesForClient;
            else delete e.notesForClient;
          if (change.exerciseId) e.exercise = change.exerciseId;
          return {};
        },
        change.exerciseId && change.exerciseName
          ? { [change.exerciseId]: { id: change.exerciseId, name: change.exerciseName } }
          : {},
      ),
    addRows: (rows) => {
      const ids = rows.map(() => newId());
      return commit(
        (s) => {
          let block = s.blocks.at(-1);
          if (!block) {
            block = {
              id: newId(),
              type: 'main_strength',
              organization: 'straight_sets',
              exercises: [],
            };
            s.blocks.push(block);
          }
          rows.forEach((r, i) =>
            block!.exercises.push({
              id: ids[i]!,
              exercise: r.exerciseId,
              prescription: r.prescription,
              ...(r.notesForClient ? { notesForClient: r.notesForClient } : {}),
            }),
          );
          return { ids };
        },
        Object.fromEntries(
          rows.map((r) => [
            r.exerciseId,
            { id: r.exerciseId, name: r.exerciseName ?? r.exerciseId },
          ]),
        ),
      );
    },
    duplicateRows: (rowIds) =>
      commit((s) => {
        const ids: string[] = [];
        for (const b of s.blocks)
          b.exercises = b.exercises.flatMap((e) => {
            if (!rowIds.includes(e.id!)) return [e];
            const copy = { ...clone(e), id: newId() };
            ids.push(copy.id);
            return [e, copy];
          });
        return { ids };
      }),
    deleteRows: (rowIds) =>
      commit((s) => {
        for (const b of s.blocks) b.exercises = b.exercises.filter((e) => !rowIds.includes(e.id!));
        return {};
      }),
    moveRow: (id, direction) =>
      commit((s) => {
        for (const b of s.blocks) {
          const i = b.exercises.findIndex((e) => e.id === id);
          if (i < 0) continue;
          const j = direction === 'up' ? i - 1 : i + 1;
          if (j < 0 || j >= b.exercises.length) return {};
          [b.exercises[i], b.exercises[j]] = [b.exercises[j]!, b.exercises[i]!];
          return {};
        }
        return { error: 'Esa fila ya no existe.' };
      }),
    refresh: () => router.refresh(),
  };

  const blocks: GridBlock[] = useMemo(
    () =>
      (current?.blocks ?? []).map((b) => ({
        id: b.id!,
        title: b.label ?? label('blockType', b.type),
        rows: b.exercises.map((e) => ({
          id: e.id!,
          blockId: b.id!,
          version: 1,
          exercise: names[e.exercise] ?? { id: e.exercise, name: e.exercise },
          category: null,
          prescription: e.prescription,
          notes: e.notesForClient ?? null,
          derived: false,
          issues: [],
        })),
      })),
    [current, names],
  );

  return (
    <section aria-labelledby="tpl-sessions" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="tpl-sessions" className="text-base font-semibold">
          Sesiones de la semana
        </h2>
        <span className="text-xs text-muted">versión {templateVersion}</span>
      </div>
      {phasesWithSessions.length ? (
        <nav aria-label="Fase" className="flex flex-wrap gap-1">
          {[{ name: 'Todas las fases', i: null as number | null }, ...phasesWithSessions].map(
            (p) => (
              <button
                key={p.name}
                type="button"
                aria-current={where.phase === p.i ? 'true' : undefined}
                onClick={() => setWhere({ phase: p.i, session: 0 })}
                className={`min-h-9 rounded-md border px-3 text-sm ${where.phase === p.i ? 'border-accent bg-accent text-accent-contrast' : 'border-border bg-bg hover:bg-surface'}`}
              >
                {p.name}
              </button>
            ),
          )}
        </nav>
      ) : null}
      <nav aria-label="Sesión" className="flex flex-wrap gap-1">
        {sessions.map((s, i) => (
          <button
            key={s.id ?? i}
            type="button"
            aria-current={i === where.session ? 'true' : undefined}
            onClick={() => setWhere({ ...where, session: i })}
            className={`min-h-9 rounded-md border px-3 text-sm ${i === where.session ? 'border-accent bg-accent text-accent-contrast' : 'border-border bg-bg hover:bg-surface'}`}
          >
            {s.dayLabel} · {s.title}
          </button>
        ))}
      </nav>
      {current?.objective ? <p className="text-xs text-muted">{current.objective}</p> : null}
      {current ? (
        <SessionGrid
          key={`${where.phase}-${where.session}`}
          gridId={`tpl-${t.id}`}
          store={store}
          blocks={blocks}
          editable={t.editable}
        />
      ) : null}
    </section>
  );
}
