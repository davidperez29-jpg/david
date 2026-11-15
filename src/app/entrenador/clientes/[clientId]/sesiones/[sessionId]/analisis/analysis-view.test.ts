import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SessionAnalysisVM } from '@/contracts/analysis';
import { analyzeSession } from '@/domain/analysis/session';
import { input, item, kg, sessionLog, setLog, version } from '@/domain/analysis/test-fixtures';
import { buildAnalysisScenarios, type ScenarioWorld } from '@/server/services/analysis-scenarios';
import { publishSessionChange, startSessionChange } from '@/server/services/trainer-sessions';
import { getSessionAnalysis } from '@/server/services/trainer-analysis';
import { FORBIDDEN_WORDS } from '@/features/trainer/analysis/analysis-copy';
import { SessionAnalysisView } from '@/features/trainer/analysis/session-analysis';

/**
 * B3.1 · La vista A8 que ve el entrenador, renderizada con los datos reales del servicio (sobre
 * los escenarios de B3.0) y con casos del dominio que las E2E no pueden producir con el reloj
 * real del servidor: huecos de horas, horas ajustadas y datos incoherentes.
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

const links = { original: '/o', current: '/c', day: '/d', session: '/s' };
const text = (vm: SessionAnalysisVM) =>
  renderToStaticMarkup(createElement(SessionAnalysisView, { vm, links }))
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

async function render(key: string, perspective: 'original' | 'current' = 'original') {
  const s = world.scenarios.find((x) => x.key === key)!;
  const vm = await getSessionAnalysis(world.contexts.trainer, {
    clientId: s.clientId,
    sessionId: s.sessionId,
    perspective,
  });
  return text(vm!);
}

describe('A8 renderizada', () => {
  it('en los 17 escenarios y las dos perspectivas: sin vocabulario prohibido, con «Qué se puede concluir» y sin índice global', async () => {
    for (const s of world.scenarios) {
      for (const perspective of ['original', 'current'] as const) {
        const t = await render(s.key, perspective);
        for (const word of FORBIDDEN_WORDS)
          expect(t, `${s.key} ${perspective}: ${word}`).not.toMatch(word);
        expect(t).toContain('Qué se puede concluir y qué no');
        expect(t).toContain(
          'confirma el registro de la serie, no una medición independiente de cada valor',
        );
        expect(t).not.toMatch(/cumplimiento (global|total)|% de cumplimiento|puntuación de/i);
        expect(t).toContain('training.compliance-profile 1.0.0');
      }
    }
  });

  it('cifras con su fórmula: repeticiones, tonelaje y duración llevan id y versión', async () => {
    const t = await render('completa');
    for (const id of [
      'training.total-reps 2.0.0',
      'training.volume-load 2.0.0',
      'training.duration-total 1.0.0',
      'training.session-calculated-duration 1.0.0',
    ]) {
      expect(t).toContain(id);
    }
    expect(t).toContain('definición de diseño (no es una fórmula científica)');
  });

  it('niveles 1 y 2 tal como los define P-91', async () => {
    expect(await render('cargas')).toContain('Carga: distinto de lo prescrito (−3 kg (−7,5 %))');
    const range = await render('rangos');
    expect(range).toContain(
      'Repeticiones: fuera del rango, por debajo (−1 rep. respecto al mínimo)',
    );
    expect(range).toContain('Rep.: dentro del rango');
  });

  it('P-120: «2 de 3 series hechas con los valores iguales a lo propuesto», con la leyenda', async () => {
    const t = await render('valores-propuestos');
    expect(t).toContain(
      '2 de 3 series hechas con los valores iguales a lo propuesto · 1 con algún valor distinto',
    );
    expect(t).toContain('un valor igual al propuesto puede haberse aceptado sin revisarlo');
    expect(t).toContain('igual a lo propuesto');
    expect(t).toContain('distinto de lo propuesto');
  });

  it('parcial: cierre parcial, sin motivos inventados', async () => {
    const t = await render('parcial');
    expect(t).toContain('Parcial');
    expect(t).toContain('Cerrada antes de terminar (1 serie pendiente confirmada)');
    expect(t).toContain('no hay motivos registrados');
    expect(t).toContain('Comentario de');
    expect(t).toContain('Hoy no me encontraba bien');
  });

  it('P-116 y P-122: advertencia y aviso, sin descontar los huecos', async () => {
    const warning = await render('hueco-advertencia');
    expect(warning).toContain(
      'Transcurrida 9 h 15 min · pausas registradas 0 min · calculada 9 h 15 min',
    );
    expect(warning).toContain('Advertencia: 9 h 5 min sin actividad registrada');
    expect(warning).toContain('Supera en más de 30 min el total de pausas registradas');
    const notice = await render('hueco-aviso');
    expect(notice).toContain('Aviso: 45 min sin actividad registrada');
    expect(notice).toContain(
      'Las pausas registradas podrían explicarlo; no se sabe dónde ocurrieron',
    );
  });

  it('modalidades: lo que no entra en el tonelaje, con su motivo', async () => {
    const t = await render('modalidades');
    expect(t).toContain('Sin calcular en el tonelaje: 2 series con carga «por lado»');
    expect(t).toContain('Sin calcular en el tonelaje: 2 series con repeticiones «por lado»');
    expect(t).toContain('Sin calcular en el tonelaje: 2 series con carga elegida por la clienta');
    expect(t).toContain('Repeticiones «por lado» (aparte)');
    expect(t).toContain('No incluye peso corporal, lastre ni asistencia');
  });

  it('en curso: avisa de que lo pendiente del móvil no se ve', async () => {
    expect(await render('en-curso')).toContain('pendiente de envío en su móvil no aparece');
  });

  it('P-121: con la fecha prevista cambiada, «Referencia histórica no determinada» y su motivo', async () => {
    const id = world.scenarios.find((s) => s.key === 'sin-empezar')!.sessionId;
    vi.setSystemTime(new Date('2026-11-24T12:30:00.000Z'));
    await startSessionChange(world.contexts.trainer, id);
    const draft = (await world.repos.training.getSession(id))!;
    await publishSessionChange(world.contexts.trainer, {
      sessionId: id,
      expectedRevision: draft.draftRevision,
      content: { ...draft.draft!, plannedDate: '2026-11-26' },
    });
    const t = await render('sin-empezar');
    expect(t).toContain(
      'Referencia histórica no determinada: Las versiones de la sesión tienen fechas previstas distintas.',
    );
    expect(t).toContain('La fecha prevista cambió entre versiones');
    expect(await render('sin-empezar', 'current')).toContain('aún no ha empezado esta sesión');
  });
});

describe('A8 con duraciones que no se pueden calcular (dominio)', () => {
  const vmOf = (log: ReturnType<typeof sessionLog>): SessionAnalysisVM => ({
    sessionId: 's-1',
    clientId: 'c-lucia',
    clientFirstName: 'Lucía',
    title: 'Fuerza',
    label: null,
    focus: 'Fuerza',
    dayOrder: 1,
    appTimeZone: 'Europe/Madrid',
    perspective: 'original',
    analysis: analyzeSession(
      input({
        versions: [version(1, [item('a', 1, { sets: 1 })])],
        execution: {
          log,
          setLogs: [
            setLog('a', 1, { reps: 10, load: kg(60) }, { performedAt: '2026-11-21T10:05:00.000Z' }),
          ],
        },
      }),
    ),
  });

  it('AC-B3-11: fin anterior al inicio → «Datos de tiempo incoherentes», sin cifras', () => {
    const t = text(
      vmOf(
        sessionLog({
          startedAt: '2026-11-21T10:00:00.000Z',
          finishedAt: '2026-11-21T09:57:00.000Z',
        }),
      ),
    );
    expect(t).toContain('Datos de tiempo incoherentes');
    expect(t).toContain('No se calcula ninguna duración');
    expect(t).not.toContain('Transcurrida');
  });

  it('una hora de fin ajustada: duración sin calcular y hueco no evaluable', () => {
    const t = text(
      vmOf(
        sessionLog({
          startedAt: '2026-11-21T10:00:00.000Z',
          finishedAt: '2026-11-21T19:00:00.000Z',
          finishClockAdjustment: 'ahead_of_server',
        }),
      ),
    );
    expect(t).toContain('Sin calcular : la hora de fin se ajustó');
    expect(t).toContain('Hueco no evaluable');
    expect(t).not.toContain('Transcurrida');
  });
});
