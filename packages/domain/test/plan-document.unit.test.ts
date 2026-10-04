import { describe, expect, it } from 'vitest';
import { planDocument, type PlanPrintInput } from '../src';

const input = (audience: PlanPrintInput['audience']): PlanPrintInput => ({
  audience,
  generatedAt: '2026-10-04T10:00:00.000Z',
  organization: 'Centro Demo',
  client: 'Iker Arrieta',
  plan: {
    name: 'Fuerza · 3 días',
    status: 'Activo',
    startDate: '2026-09-21',
    endDate: '2026-10-04',
    objective: null,
  },
  weeks: [
    {
      index: 1,
      type: 'introduction',
      startDate: '2026-09-21',
      phase: 'Base',
      notes: 'Semana de adaptación',
      sessions: [
        {
          dayLabel: 'Día A',
          title: 'Fuerza tren inferior',
          date: '2026-09-21',
          minutes: 60,
          objective: 'Técnica de sentadilla',
          notesForClient: 'Trae zapatillas planas',
          notesForTrainer: 'Vigilar la rodilla',
          blocks: [
            {
              label: null,
              type: 'main_strength',
              exercises: [
                {
                  name: 'Sentadilla trasera',
                  prescription: audience === 'staff' ? '4×6 @ RIR 2' : '4 series de 6 repeticiones',
                  notesForClient: 'Baja controlando',
                  coachNotes: 'Corregir profundidad',
                  alternatives: ['Sentadilla goblet'],
                },
                {
                  name: 'Peso muerto rumano',
                  prescription: '',
                  notesForClient: null,
                  coachNotes: null,
                  alternatives: [],
                },
              ],
            },
          ],
        },
      ],
    },
    { index: 2, type: 'deload', startDate: '2026-09-28', phase: 'Base', notes: null, sessions: [] },
  ],
});

describe('plan document (PDF of the plan)', () => {
  it('team version: one section per week, technical prescription and internal notes', () => {
    const d = planDocument(input('staff'));
    expect(d.title).toBe('Plan: Fuerza · 3 días');
    expect(d.sections.map((s) => s.title)).toEqual([
      'Semana 1 (21/09/2026 – 27/09/2026) · Introducción · Base',
      'Semana 2 (28/09/2026 – 04/10/2026) · Descarga · Base',
    ]);
    const text = JSON.stringify(d);
    expect(text).toMatch(/Día A: Fuerza tren inferior · 21\/09\/2026 · ≈ 60 min/);
    expect(text).toMatch(/Nota interna: Vigilar la rodilla/);
    expect(text).toMatch(/Semana de adaptación/);
    const table = d.sections[0]!.blocks.find((b) => b.kind === 'table')!;
    expect(table).toMatchObject({
      columns: ['Bloque', 'Ejercicio', 'Prescripción', 'Notas'],
      rows: [
        [
          'Fuerza',
          'Sentadilla trasera',
          '4×6 @ RIR 2',
          'Corregir profundidad · Baja controlando · Alternativas: Sentadilla goblet',
        ],
        ['', 'Peso muerto rumano', '—', ''],
      ],
    });
    expect(d.sections[1]!.blocks).toEqual([{ kind: 'text', text: 'Sin sesiones.', tone: 'muted' }]);
    expect(d.footer.join(' ')).toMatch(/incluye notas internas/);
  });

  it("client version: plain language and never the trainer's internal notes", () => {
    const d = planDocument(input('client'));
    const text = JSON.stringify(d);
    expect(d.title).toBe('Tu plan: Fuerza · 3 días');
    expect(text).not.toMatch(/Vigilar la rodilla|Corregir profundidad|Semana de adaptación|Activo/);
    expect(text).toMatch(/Trae zapatillas planas/);
    expect(text).toMatch(/4 series de 6 repeticiones/);
    expect(text).toMatch(/Qué hacer/);
    expect(text).toMatch(/Sin sesiones publicadas esta semana/);
    expect(text).toMatch(/para y avisa a tu entrenador/);
    expect(planDocument(input('client'))).toEqual(d);
  });
});
