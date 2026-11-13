import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isoWeekKey, localDateOf } from '@/domain/time';
import { buildAnalysisScenarios, type ScenarioWorld } from './analysis-scenarios';
import { getClientExecutionState } from './client-execution';
import { getTrainerSessions, publishSessionChange, startSessionChange } from './trainer-sessions';

/**
 * B3.0 · Los escenarios de prueba para B3.1 (docs/BLOCK3_SPEC.md §14) se crean por los caminos
 * reales, son reproducibles y dicen la verdad sobre lo que contienen.
 */
beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
afterEach(() => vi.useRealTimers());

const setClock = (at: string) => vi.setSystemTime(new Date(at));
const build = () => buildAnalysisScenarios({ setClock });

function dump(world: ScenarioWorld) {
  const { db } = world;
  return {
    sessions: db
      .prepare(
        `SELECT id, client_id, planned_date, day_order, label, status, current_version
         FROM session WHERE id LIKE 's-escenario-%' ORDER BY id`,
      )
      .all(),
    versions: db
      .prepare(
        `SELECT session_id, number, content, published_at, reason, execution_state
         FROM session_version WHERE session_id LIKE 's-escenario-%' ORDER BY session_id, number`,
      )
      .all(),
    logs: db
      .prepare(
        `SELECT session_id, started_version, started_at, finished_at, finish_reason,
                pending_sets_confirmed, paused_seconds, comment
         FROM session_log WHERE session_id LIKE 's-escenario-%' ORDER BY session_id`,
      )
      .all(),
    sets: db
      .prepare(
        `SELECT client_set_id, session_id, version_number, prescription_id, set_number, completed,
                reps, duration_s, distance_m, load_kind, load_kg, load_descriptor, rir, rpe,
                rpe_scale, performed_at, received_at, clock_adjustment, origin, recorded_by
         FROM set_log WHERE session_id LIKE 's-escenario-%' ORDER BY client_set_id`,
      )
      .all(),
  };
}

describe('escenarios de análisis', () => {
  it('se crean todos por los servicios reales y la base coincide con lo que dicen', async () => {
    const world = await build();
    const { db, scenarios } = world;
    expect(scenarios.map((s) => s.key)).toEqual([
      'completa',
      'parcial',
      'sin-empezar',
      'versiones',
      'repeticiones',
      'rangos',
      'cargas',
      'esfuerzo-ausente',
      'trasladada',
      'medianoche',
      'pausas',
      'hueco-advertencia',
      'hueco-aviso',
      'valores-propuestos',
      'modalidades',
      'en-curso',
      'semana-53',
    ]);
    for (const s of scenarios) {
      const versions = db
        .prepare('SELECT COUNT(*) AS n FROM session_version WHERE session_id = @id')
        .get<{ n: number }>({ id: s.sessionId })!.n;
      expect(versions, s.key).toBe(s.facts.versions);
      const log = db
        .prepare(
          'SELECT started_at, start_time_zone, finished_at FROM session_log WHERE session_id = @id',
        )
        .get<{ started_at: string; start_time_zone: string; finished_at: string | null }>({
          id: s.sessionId,
        });
      expect(log ? localDateOf(log.started_at, log.start_time_zone) : null, s.key).toBe(
        s.facts.executedOn,
      );
      expect(Boolean(log?.finished_at), s.key).toBe(s.facts.finished);
      const sets = db
        .prepare(
          `SELECT prescription_id, set_number, version_number, completed FROM set_log
           WHERE session_id = @id ORDER BY performed_at`,
        )
        .all<{
          prescription_id: string;
          set_number: number;
          version_number: number;
          completed: number;
        }>({ id: s.sessionId });
      expect(
        sets.map((r) => [r.prescription_id, r.set_number, r.version_number, r.completed === 1]),
        s.key,
      ).toEqual(
        s.facts.sets.map((f) => [
          f.prescriptionId,
          f.setNumber,
          f.versionNumber,
          f.entry !== 'not_done',
        ]),
      );
    }
    // Ninguna hora ajustada: los relojes del escenario son coherentes (ADR-28).
    expect(
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM set_log WHERE session_id LIKE 's-escenario-%'
           AND clock_adjustment IS NOT NULL`,
        )
        .get<{ n: number }>()!.n,
    ).toBe(0);
    db.close();
  });

  it('cubre los casos que B3.1 tendrá que tratar', async () => {
    const { db, scenarios } = await build();
    const by = (key: string) => scenarios.find((s) => s.key === key)!;
    const one = <T>(sql: string, id: string) => db.prepare(sql).get<T>({ id })!;

    // Versiones: series 1 y 2 con la v1, la 3 con la v2; la v3 se publicó al terminar, con motivo.
    expect(by('versiones').facts.sets.map((f) => f.versionNumber)).toEqual([1, 1, 2]);
    expect(
      one<{ execution_state: string; reason: string }>(
        'SELECT execution_state, reason FROM session_version WHERE session_id = @id AND number = 3',
        by('versiones').sessionId,
      ),
    ).toEqual({ execution_state: 'finished', reason: 'Ajuste para la próxima vez' });

    // Fecha prevista frente a ejecución; medianoche; semana 53.
    expect([by('trasladada').plannedDate, by('trasladada').facts.executedOn]).toEqual([
      '2026-11-16',
      '2026-11-17',
    ]);
    expect(by('medianoche').facts.executedOn).toBe('2026-11-18');
    expect(
      db
        .prepare('SELECT performed_at FROM set_log WHERE session_id = @id ORDER BY performed_at')
        .all<{ performed_at: string }>({ id: by('medianoche').sessionId })
        .map((r) => localDateOf(r.performed_at, 'Europe/Madrid')),
    ).toEqual(['2026-11-18', '2026-11-19']);
    expect(isoWeekKey(by('semana-53').facts.executedOn!)).toBe('2026-W53');

    // Pausas: 20 min y 40 min registradas; el hueco de la advertencia no tiene ninguna.
    const paused = (key: string) =>
      one<{ p: number }>(
        'SELECT paused_seconds AS p FROM session_log WHERE session_id = @id',
        by(key).sessionId,
      ).p;
    expect([paused('pausas'), paused('hueco-aviso'), paused('hueco-advertencia')]).toEqual([
      1200, 2400, 0,
    ]);

    // Dos sesiones ejecutadas el mismo día.
    expect(scenarios.filter((s) => s.facts.executedOn === '2026-11-13').map((s) => s.key)).toEqual([
      'repeticiones',
      'rangos',
    ]);

    // Parcial: una «no realizada» y cierre con la serie pendiente confirmada.
    expect(
      one<{ finish_reason: string; pending_sets_confirmed: number }>(
        'SELECT finish_reason, pending_sets_confirmed FROM session_log WHERE session_id = @id',
        by('parcial').sessionId,
      ),
    ).toEqual({ finish_reason: 'ended_early', pending_sets_confirmed: 1 });

    // Esfuerzo prescrito sin anotar: hay series sin RIR ni RPE.
    expect(
      one<{ n: number }>(
        'SELECT COUNT(*) AS n FROM set_log WHERE session_id = @id AND rir IS NULL AND rpe IS NULL',
        by('esfuerzo-ausente').sessionId,
      ).n,
    ).toBe(3);

    // Modalidades guardadas tal cual; la asistencia sin anotar queda nula.
    expect(
      db
        .prepare(`SELECT DISTINCT load_kind FROM set_log WHERE session_id = @id ORDER BY load_kind`)
        .all<{ load_kind: string }>({ id: by('modalidades').sessionId })
        .map((r) => r.load_kind),
    ).toEqual([
      'assisted',
      'bodyweight',
      'bodyweight_plus',
      'device',
      'elastic',
      'external',
      'other',
      'self_selected',
    ]);
    expect(
      one<{ load_kg: number | null }>(
        `SELECT load_kg FROM set_log WHERE session_id = @id AND prescription_id = 'itm-pullup-assisted'
         AND set_number = 2`,
        by('modalidades').sessionId,
      ).load_kg,
    ).toBeNull();
    db.close();
  });

  it('valores propuestos: la base no distingue una serie aceptada sin tocar de una confirmada', async () => {
    const { db, scenarios } = await build();
    const s = scenarios.find((x) => x.key === 'valores-propuestos')!;
    expect(s.facts.sets.map((f) => f.entry)).toEqual([
      'proposed_unchanged',
      'proposed_plus_effort',
      'edited',
    ]);
    const rows = db
      .prepare(
        `SELECT set_number, reps, load_kg, rir, origin, recorded_by FROM set_log
         WHERE session_id = @id ORDER BY set_number`,
      )
      .all({ id: s.sessionId });
    // La serie 1 se guarda exactamente como lo prescrito (10 × 16 kg) y con la misma procedencia
    // que las demás: nada en la fila dice que la clienta no la cambió.
    expect(rows).toEqual([
      {
        set_number: 1,
        reps: 10,
        load_kg: 16,
        rir: null,
        origin: 'self_reported',
        recorded_by: 'client',
      },
      {
        set_number: 2,
        reps: 10,
        load_kg: 16,
        rir: 2,
        origin: 'self_reported',
        recorded_by: 'client',
      },
      {
        set_number: 3,
        reps: 8,
        load_kg: 16,
        rir: 0,
        origin: 'self_reported',
        recorded_by: 'client',
      },
    ]);
    db.close();
  });

  it('P-116 y P-117: lo que el historial permite saber y lo que no', async () => {
    const { db, repos, scenarios, contexts } = await build();
    const by = (key: string) => scenarios.find((s) => s.key === key)!;
    const minutes = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60_000;

    // P-116 · Los huecos se ven con las horas guardadas (inicio, cada serie y fin), y se sabe si
    // alguna se ajustó (ADR-28).
    const gaps = (sessionId: string) => {
      const log = db
        .prepare(
          `SELECT started_at, finished_at, paused_seconds, start_clock_adjustment AS a1,
                  finish_clock_adjustment AS a2 FROM session_log WHERE session_id = @id`,
        )
        .get<{
          started_at: string;
          finished_at: string;
          paused_seconds: number;
          a1: string | null;
          a2: string | null;
        }>({ id: sessionId })!;
      const sets = db
        .prepare(
          'SELECT performed_at, clock_adjustment FROM set_log WHERE session_id = @id ORDER BY performed_at',
        )
        .all<{ performed_at: string; clock_adjustment: string | null }>({ id: sessionId });
      const times = [log.started_at, ...sets.map((s) => s.performed_at), log.finished_at];
      return {
        largest: Math.max(...times.slice(1).map((t, i) => minutes(times[i]!, t))),
        pausedMinutes: log.paused_seconds / 60,
        adjusted: [log.a1, log.a2, ...sets.map((s) => s.clock_adjustment)].some((a) => a !== null),
      };
    };
    expect(gaps(by('hueco-advertencia').sessionId)).toEqual({
      largest: 545,
      pausedMinutes: 0,
      adjusted: false,
    });
    expect(gaps(by('hueco-aviso').sessionId)).toEqual({
      largest: 45,
      pausedMinutes: 40,
      adjusted: false,
    });
    // …pero no dónde estuvieron las pausas: solo el total; la pausa abierta se borra al reanudar
    // y los comandos guardan la hora de llegada, no la del móvil.
    const columns = (table: string) =>
      db
        .prepare('SELECT name FROM pragma_table_info(@table)')
        .all<{ name: string }>({ table })
        .map((c) => c.name);
    expect(columns('session_log').filter((c) => c.includes('pause'))).toEqual([
      'paused_at',
      'paused_seconds',
    ]);
    expect(columns('client_command')).toEqual([
      'command_id',
      'session_id',
      'client_id',
      'type',
      'payload_hash',
      'received_at',
    ]);
    expect(
      db
        .prepare('SELECT paused_at FROM session_log WHERE session_id = @id')
        .get({ id: by('hueco-aviso').sessionId }),
    ).toEqual({ paused_at: null });

    // P-117 · Sesión empezada: la versión de inicio y la de cada serie son datos guardados.
    expect(
      db
        .prepare('SELECT started_version FROM session_log WHERE session_id = @id')
        .get({ id: by('versiones').sessionId }),
    ).toEqual({ started_version: 1 });

    // Sesión sin empezar: un cambio publicado PUEDE mover la fecha prevista. Cada versión guarda
    // la suya; la sesión, solo la vigente. «El fin del día previsto» depende de qué versión se mire.
    const id = by('sin-empezar').sessionId;
    setClock('2026-11-24T12:30:00.000Z');
    expect(await startSessionChange(contexts.trainer, id)).toBe('started');
    const draft = (await repos.training.getSession(id))!;
    const moved = await publishSessionChange(contexts.trainer, {
      sessionId: id,
      expectedRevision: draft.draftRevision,
      content: { ...draft.draft!, plannedDate: '2026-11-26' },
    });
    expect(moved.ok).toBe(true);
    expect(
      db
        .prepare(
          `SELECT number, json_extract(content, '$.plannedDate') AS planned FROM session_version
           WHERE session_id = @id ORDER BY number`,
        )
        .all({ id }),
    ).toEqual([
      { number: 1, planned: '2026-11-11' },
      { number: 2, planned: '2026-11-26' },
    ]);
    expect(db.prepare('SELECT planned_date FROM session WHERE id = @id').get({ id })).toEqual({
      planned_date: '2026-11-26',
    });
    db.close();
  });

  it('permisos: otro entrenador y otra clienta no ven nada; la propia clienta, lo suyo', async () => {
    const { db, scenarios, contexts } = await build();
    const lucia = scenarios.find((s) => s.key === 'completa')!;
    expect(await getTrainerSessions(contexts.otherTrainer, lucia.clientId)).toBeNull();
    expect(await getTrainerSessions(contexts.trainer, lucia.clientId)).not.toBeNull();
    expect(await getClientExecutionState(contexts.marta, lucia.sessionId)).toBeNull();
    expect(await getClientExecutionState(contexts.lucia, lucia.sessionId)).not.toBeNull();
    db.close();
  });

  it('es reproducible: dos construcciones dan exactamente los mismos datos', async () => {
    const first = await build();
    const second = await build();
    expect(dump(second)).toEqual(dump(first));
    first.db.close();
    second.db.close();
  });

  it('se niega a crear escenarios fuera de la memoria o del directorio temporal', async () => {
    await expect(
      buildAnalysisScenarios({ setClock, path: '.data/trainpro.sqlite' }),
    ).rejects.toThrow('directorio temporal');
  });
});
