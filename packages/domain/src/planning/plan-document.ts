/**
 * Printable plan (pending 5 of Phase 15): weeks → sessions → blocks → exercises with their
 * prescription, as the same neutral blocks the client report uses, so the PDF renderer is shared.
 *
 * Two audiences from the same plan:
 * - staff: technical prescription (3×8 @ RIR 2 · descanso 2 min), coach notes and session notes for
 *   the trainer;
 * - client: plain-language prescription and only what is written for the client (never coach
 *   notes). The application decides which sessions go in (a client only gets published ones).
 * Pure and deterministic.
 */
import { reportDate, type ClientReport, type ReportBlock } from '../reports/report';

export type PlanAudience = 'staff' | 'client';

export interface PlanPrintInput {
  audience: PlanAudience;
  generatedAt: string;
  organization: string;
  client: string;
  plan: {
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    objective: string | null;
  };
  weeks: {
    index: number;
    type: string;
    startDate: string | null;
    phase: string | null;
    notes: string | null;
    sessions: {
      dayLabel: string;
      title: string | null;
      date: string | null;
      minutes: number | null;
      objective: string | null;
      notesForClient: string | null;
      notesForTrainer: string | null;
      blocks: {
        label: string | null;
        type: string;
        exercises: {
          name: string;
          /** Already rendered for the audience (technical or plain language). */
          prescription: string;
          notesForClient: string | null;
          coachNotes: string | null;
          alternatives: string[];
        }[];
      }[];
    }[];
  }[];
}

export const WEEK_TYPE_LABELS: Record<string, string> = {
  introduction: 'Introducción',
  progression: 'Progresión',
  peak: 'Pico',
  deload: 'Descarga',
  test: 'Evaluación',
  taper: 'Afinamiento',
  transition: 'Transición',
  competition: 'Competición',
};

export const BLOCK_TYPE_LABELS: Record<string, string> = {
  warm_up: 'Calentamiento',
  activation: 'Activación',
  power_potentiation: 'Potenciación',
  main_strength: 'Fuerza',
  hypertrophy: 'Hipertrofia',
  plyometric: 'Pliometría',
  sprint_cod: 'Sprint / COD',
  conditioning: 'Acondicionamiento',
  core: 'Core',
  mobility: 'Movilidad',
  cool_down: 'Vuelta a la calma',
  custom: 'Otro',
};

const join = (...xs: (string | null | undefined)[]) => xs.filter(Boolean).join(' · ');

const addDays = (iso: string, d: number) => {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};

export function planDocument(i: PlanPrintInput): ClientReport {
  const staff = i.audience === 'staff';
  const sections = i.weeks.map((w) => {
    const blocks: ReportBlock[] = [];
    if (staff && w.notes) blocks.push({ kind: 'text', text: w.notes, tone: 'muted' });
    if (!w.sessions.length)
      blocks.push({
        kind: 'text',
        text: staff ? 'Sin sesiones.' : 'Sin sesiones publicadas esta semana.',
        tone: 'muted',
      });
    for (const s of w.sessions) {
      blocks.push({
        kind: 'text',
        text: join(
          s.title ? `${s.dayLabel}: ${s.title}` : s.dayLabel,
          s.date ? reportDate(s.date) : null,
          s.minutes ? `≈ ${s.minutes} min` : null,
        ),
      });
      if (s.objective)
        blocks.push({ kind: 'text', text: `Objetivo: ${s.objective}`, tone: 'muted' });
      if (s.notesForClient)
        blocks.push({
          kind: 'text',
          text: staff ? `Nota para el cliente: ${s.notesForClient}` : s.notesForClient,
          tone: 'muted',
        });
      if (staff && s.notesForTrainer)
        blocks.push({ kind: 'text', text: `Nota interna: ${s.notesForTrainer}`, tone: 'muted' });
      const rows = s.blocks.flatMap((b) =>
        b.exercises.map((e, n) => [
          n === 0 ? (b.label ?? BLOCK_TYPE_LABELS[b.type] ?? b.type) : '',
          e.name,
          e.prescription || '—',
          join(
            staff ? e.coachNotes : null,
            e.notesForClient,
            e.alternatives.length ? `Alternativas: ${e.alternatives.join(', ')}` : null,
          ) || '',
        ]),
      );
      if (rows.length)
        blocks.push({
          kind: 'table',
          columns: ['Bloque', 'Ejercicio', staff ? 'Prescripción' : 'Qué hacer', 'Notas'],
          rows,
        });
      else blocks.push({ kind: 'text', text: 'Sesión sin ejercicios.', tone: 'muted' });
    }
    const range = w.startDate
      ? ` (${reportDate(w.startDate)} – ${reportDate(addDays(w.startDate, 6))})`
      : '';
    return {
      number: w.index,
      key: `semana-${w.index}`,
      title: `Semana ${w.index}${range} · ${join(WEEK_TYPE_LABELS[w.type] ?? w.type, w.phase)}`,
      blocks,
    };
  });
  return {
    title: staff ? `Plan: ${i.plan.name}` : `Tu plan: ${i.plan.name}`,
    subtitle: join(
      i.organization,
      i.client,
      `${reportDate(i.plan.startDate)} – ${reportDate(i.plan.endDate)}`,
      staff ? i.plan.status : null,
    ),
    generatedAt: i.generatedAt,
    sections,
    footer: staff
      ? [
          `Generado el ${reportDate(i.generatedAt)}. Versión del equipo: incluye notas internas.`,
          'Para entregar al cliente, usa la versión del cliente.',
        ]
      : [
          `Generado el ${reportDate(i.generatedAt)}. Si algo te duele o no te encuentras bien, para y avisa a tu entrenador.`,
          'Tu entrenador puede ajustar el plan según cómo respondas.',
        ],
  };
}
