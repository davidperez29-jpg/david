/**
 * Plan proposal (§12.2 point 5): a template adapted to the decision engine's result. Pure; the
 * result is materialized as a `PROPOSAL` plan that the trainer edits, accepts or discards. It
 * never touches the client's active plan.
 */
import type { DecisionResult } from '../decision/types';
import {
  defaultWeekTypes,
  type TemplateDefinition,
  type TemplateSession,
  type WeekType,
} from '../planning/structure';

export interface Replacement {
  /** Exercise id (or slug) used in the template. */
  from: string;
  fromName: string;
  /** Exercise id that replaces it. */
  to: string;
  toName: string;
  reason: string;
}

export interface AdaptedTemplate {
  definition: TemplateDefinition;
  /** What was changed and why, in plain language (shown on the proposal). */
  notes: string[];
}

/** Introduction weeks per intro-phase level (§13.5): a score, never one rule for everyone. */
export const INTRO_WEEKS: Record<DecisionResult['introPhase']['level'], number> = {
  ninguna: 0,
  'introducción breve': 1,
  'fase de adaptación': 2,
};

function replaceIn(sessions: TemplateSession[], map: Map<string, string>): TemplateSession[] {
  return sessions.map((s) => ({
    ...s,
    blocks: s.blocks.map((b) => ({
      ...b,
      exercises: b.exercises.map((e) =>
        map.has(e.exercise) ? { ...e, exercise: map.get(e.exercise)! } : e,
      ),
    })),
  }));
}

export function adaptTemplate(
  def: TemplateDefinition,
  opts: {
    introLevel: DecisionResult['introPhase']['level'];
    replacements: Replacement[];
    templateName: string;
  },
): AdaptedTemplate {
  const notes: string[] = [`Punto de partida: plantilla «${opts.templateName}» (editable).`];
  const intro = INTRO_WEEKS[opts.introLevel];
  let first = true;
  const phases = def.phases.map((ph) => ({
    ...ph,
    mesocycles: ph.mesocycles.map((m) => {
      if (!first) return m;
      first = false;
      const types: WeekType[] = [...(m.weekTypes ?? defaultWeekTypes(m.weeks))];
      for (let i = 0; i < types.length; i++) {
        // The first `intro` weeks are introduction; the template's later deload/test weeks stay.
        if (i < intro && types[i] !== 'deload' && types[i] !== 'test') types[i] = 'introduction';
        else if (i >= intro && types[i] === 'introduction') types[i] = 'progression';
      }
      return { ...m, weekTypes: types };
    }),
  }));
  notes.push(
    intro === 0
      ? 'Sin semanas de introducción: el motor no vio necesidad de fase de adaptación.'
      : `${intro === 1 ? 'Primera semana' : `Primeras ${intro} semanas`} de introducción (${opts.introLevel}, según el motor de decisiones).`,
  );
  const map = new Map(opts.replacements.map((r) => [r.from, r.to]));
  for (const r of opts.replacements) notes.push(`${r.fromName} → ${r.toName}: ${r.reason}`);
  return {
    definition: {
      ...def,
      phases,
      sessions: replaceIn(def.sessions, map),
      weeks: def.weeks?.map((w) => ({ ...w, sessions: replaceIn(w.sessions, map) })),
    },
    notes,
  };
}
