import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ClientAnalysisVM, type ExerciseEvolutionVM } from '@/contracts/analysis';
import { FORBIDDEN_WORDS, weekText } from '@/features/trainer/analysis/analysis-copy';
import { analysisState, hrefWith } from '@/features/trainer/analysis/analysis-links';
import { ClientAnalysisView } from '@/features/trainer/analysis/client-analysis';
import { ExerciseEvolutionView } from '@/features/trainer/analysis/exercise-evolution';
import { buildAnalysisScenarios, type ScenarioWorld } from '@/server/services/analysis-scenarios';
import { getClientAnalysis, getExerciseEvolution } from '@/server/services/trainer-analysis';

/**
 * B3.2 · A9 y A10 renderizadas con los datos reales del servicio (escenarios de B3.0): el
 * vocabulario permitido, la fórmula de cada cifra, la semana 53 y las semanas vacías.
 */
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement('a', { href, ...rest }, children),
}));

beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
afterEach(() => vi.useRealTimers());

let world: ScenarioWorld;
beforeEach(async () => {
  world = await buildAnalysisScenarios({ setClock: (at) => vi.setSystemTime(new Date(at)) });
});
afterEach(() => world.db.close());

const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

const BASE = '/entrenador/clientes/c-lucia/analisis';

async function a9(
  query: Record<string, string> = {},
  perspective: 'original' | 'current' = 'original',
) {
  const vm = (await getClientAnalysis(world.contexts.trainer, {
    clientId: 'c-lucia',
    query,
    perspective,
  })) as ClientAnalysisVM;
  const html = renderToStaticMarkup(
    createElement(ClientAnalysisView, {
      vm,
      base: BASE,
      sessionHref: (id: string) => `/s/${id}`,
      exerciseHref: (id: string) => `/e/${id}`,
    }),
  );
  return { vm, html, text: plain(html) };
}

const FORMULAS = [
  'training.session-adherence 1.0.0',
  'training.weekly-executed-volume 1.0.0',
  'training.weekly-planned-volume 1.0.0',
  'training.period-duration-totals 1.0.0',
  'training.pattern-set-count 1.0.0',
  'training.repeated-differences 1.0.0',
  'training.exercise-evolution 1.0.0',
  'training.completed-sets 1.0.0',
  'training.total-reps 2.0.0',
  'training.volume-load 2.0.0',
  'training.added-load-volume 1.0.0',
  'training.assistance-summary 1.0.0',
];

describe('A9 renderizada', () => {
  it('en varios periodos, perspectivas, filtros y magnitudes: vocabulario permitido, límites y la fórmula de cada cifra', async () => {
    for (const [query, perspective] of [
      [{}, 'original'],
      [{}, 'current'],
      [{ periodo: '12-semanas', magnitud: 'tonelaje' }, 'original'],
      [{ periodo: 'semana', fecha: '2026-11-23', magnitud: 'lastre' }, 'current'],
      [{ ejercicio: 'ex-goblet-squat', patrones: 'todos', orden: 'asc' }, 'original'],
      [{ periodo: 'rango', desde: '2026-11-01', hasta: '2027-01-10', n: '1', m: '3' }, 'original'],
    ] as const) {
      const { text } = await a9({ ...query }, perspective);
      const label = `${JSON.stringify(query)} ${perspective}`;
      for (const word of FORBIDDEN_WORDS) expect(text, `${label}: ${word}`).not.toMatch(word);
      expect(text, label).toContain('Qué se puede concluir y qué no');
      expect(text, label).toContain('Carga interna: pendiente (B3.3)');
      expect(text, label).not.toMatch(/cumplimiento (global|total)|puntuación|ranking|\d\s?%/i);
      for (const formula of FORMULAS) expect(text, `${label}: ${formula}`).toContain(formula);
      expect(text, label).toContain('Por fecha prevista.');
      expect(text, label).toContain('Por fecha de ejecución.');
    }
  });

  it('AC-B3-14 · la semana 53 se rotula «28 dic 2026 – 3 ene 2027»', async () => {
    expect(weekText({ key: '2026-W53', start: '2026-12-28', end: '2027-01-03' })).toBe(
      'Semana 53 de 2026 (ISO): 28 dic 2026 – 3 ene 2027',
    );
    const { text } = await a9({ periodo: 'semana', fecha: '2027-01-01' });
    expect(text).toContain('Semana 53 de 2026 (ISO): 28 dic 2026 – 3 ene 2027');
    expect(text).toContain('Semana 53 de 2026 28 dic 2026 – 3 ene 2027');
  });

  it('AC-B3-18 · las semanas vacías, en la tabla con cero', async () => {
    const { vm, html } = await a9({ periodo: '12-semanas' });
    const empty = vm.analysis.weeks.find(
      (w) => w.planned.sessions === 0 && w.executed.sessions === 0,
    )!;
    const row = html.match(new RegExp(`<tr[^>]*data-week="${empty.week.key}"[\\s\\S]*?</tr>`))![0];
    expect(plain(row)).toMatch(/ 0 0 series 0 0 series —/);
  });

  it('lo prescrito que no se puede determinar se dice («incompleto»), y no se dibuja', async () => {
    // El día previsto de «sin-empezar» (miércoles 11) aún no ha terminado: en la original, su
    // referencia no está determinada (B3.1); en la vigente, sí.
    vi.setSystemTime(new Date('2026-11-11T10:00:00.000Z'));
    const original = await a9({ periodo: 'semana', fecha: '2026-11-11' });
    const w46 = original.vm.analysis.weeks[0]!;
    expect(w46.planned.volume.unknownSessions).toBe(1);
    expect(original.text).toContain(
      'incompleto: 1 sesión con series sin referencia determinada (con la prescripción vigente se ven)',
    );
    const current = await a9({ periodo: 'semana', fecha: '2026-11-11' }, 'current');
    expect(current.vm.analysis.weeks[0]!.planned.volume.unknownSessions).toBe(0);
    expect(current.text).not.toContain('incompleto:');
  });

  it('un periodo no válido se avisa', async () => {
    const { text } = await a9({ periodo: 'rango', desde: '2026-11-30', hasta: '2026-11-01' });
    expect(text).toContain('Periodo no válido');
  });

  it('los enlaces conservan el estado: periodo, perspectiva y filtros', async () => {
    const { vm, html } = await a9(
      { periodo: '12-semanas', ejercicio: 'ex-goblet-squat' },
      'current',
    );
    const state = analysisState({
      period: vm.analysis.period,
      perspective: vm.perspective,
      today: vm.today,
      filters: vm.filters,
    });
    expect(state).toEqual({
      periodo: '12-semanas',
      referencia: 'vigente',
      ejercicio: 'ex-goblet-squat',
    });
    const previous = hrefWith(BASE, state, { fecha: vm.analysis.period.previous.anchor });
    expect(html).toContain(previous.replace(/&/g, '&amp;'));
    expect(previous).toBe(
      `${BASE}?periodo=12-semanas&referencia=vigente&ejercicio=ex-goblet-squat&fecha=2026-09-01`,
    );
  });
});

describe('A10 renderizada', () => {
  it('vocabulario permitido, sin 1RM estimado ni tendencias, con la modalidad y la fórmula', async () => {
    for (const perspective of ['original', 'current'] as const) {
      const vm = (await getExerciseEvolution(world.contexts.trainer, {
        clientId: 'c-lucia',
        variantId: 'ex-goblet-squat',
        query: {},
        perspective,
      })) as ExerciseEvolutionVM;
      const text = plain(
        renderToStaticMarkup(
          createElement(ExerciseEvolutionView, {
            vm,
            base: `${BASE}/ejercicios/ex-goblet-squat`,
            backHref: BASE,
            sessionHref: (id: string) => `/s/${id}`,
          }),
        ),
      );
      for (const word of FORBIDDEN_WORDS) expect(text, `${perspective}: ${word}`).not.toMatch(word);
      expect(text).toContain('Qué se puede concluir y qué no');
      expect(text).toContain('no se estima el 1RM');
      expect(text).not.toMatch(/1RM estimado|tendencia (al alza|a la baja)|predicción de/i);
      expect(text).toContain('training.exercise-evolution 1.0.0');
      expect(text).toContain(vm.evolution.segments[0]!.modality!.text);
      expect(text).toContain('kg registrados de cada serie hecha');
    }
  });
});
