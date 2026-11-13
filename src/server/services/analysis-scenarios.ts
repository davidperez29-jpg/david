import 'server-only';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { type ClientCommand } from '@/contracts/execution';
import { type ClientActor, type TrainerActor } from '@/domain/access';
import { type PerformedLoad } from '@/domain/training/load';
import { defaultPerformed, type PerformedSetInput } from '@/domain/training/performance';
import { resolveSets, type SessionContent, type SessionItem } from '@/domain/training/session-v2';
import { type IsoDate, type IsoDateTime } from '@/domain/time';
import { type ClientContext, type TrainerContext } from '../context';
import { type SqlDatabase } from '../db/sqlite';
import { seededTestDatabase } from '../db/test-support';
import { DEMO_CLIENT_ID, DEMO_NEW_CLIENT_ID, DEMO_TRAINER_ID } from '../repositories/demo/dataset';
import { type Repositories } from '../repositories/ports';
import { executeClientCommand } from './client-execution';
import {
  createSessionDraft,
  getSessionBuilder,
  publishSession,
  publishSessionChange,
  startSessionChange,
} from './trainer-sessions';

/**
 * SOLO PARA PRUEBAS (B3.0, docs/BLOCK3_SPEC.md §14). Escenarios deterministas para probar el
 * análisis de B3.1 sobre una base SQLite real.
 *
 * - **Por los caminos reales:** todo se crea con los mismos servicios que usa la aplicación
 *   (crear, publicar, cambiar versión y comandos de la clienta). No hay SQL directo, así que los
 *   datos cumplen las mismas reglas que los de verdad.
 * - **Deterministas:**
 *   - fechas, horas, identificadores de sesión y de comando fijos, con el reloj del servidor
 *     controlado por la prueba (`setClock`);
 *   - el único valor aleatorio es la clave interna de cada fila de versión, que no tiene
 *     significado.
 * - **Nunca en una base real:** solo en memoria o en un archivo dentro del directorio temporal.
 * - **Lo generado no es observado:** son datos ficticios de prueba. La «verdad» de cada escenario
 *   (por ejemplo, si un valor se aceptó tal como se proponía) va en `facts`, porque la base no la
 *   guarda (`docs/BLOCK3_SPEC.md` §2.2).
 *
 * Zona de la clienta: Europe/Madrid (UTC+1 en noviembre y enero).
 */
export type ScenarioKey =
  | 'completa'
  | 'parcial'
  | 'sin-empezar'
  | 'versiones'
  | 'repeticiones'
  | 'rangos'
  | 'cargas'
  | 'esfuerzo-ausente'
  | 'trasladada'
  | 'medianoche'
  | 'pausas'
  | 'hueco-advertencia'
  | 'hueco-aviso'
  | 'valores-propuestos'
  | 'modalidades'
  | 'en-curso'
  | 'semana-53';

/** Cómo se registró cada serie (lo que la base NO puede distinguir: ver `facts`). */
export type EntryKind =
  | 'proposed_unchanged' // la clienta pulsó «Serie hecha» sin tocar los valores propuestos
  | 'proposed_plus_effort' // valores propuestos y RIR/RPE escrito por ella
  | 'edited' // cambió algún valor propuesto
  | 'not_done'; // marcó «no realizada»

export interface ScenarioSetFact {
  prescriptionId: string;
  setNumber: number;
  versionNumber: number;
  entry: EntryKind;
}

export interface Scenario {
  key: ScenarioKey;
  title: string;
  sessionId: string;
  clientId: string;
  plannedDate: IsoDate;
  /** Qué casos de B3.1 cubre (docs/BLOCK3_SPEC.md §15). */
  covers: string[];
  facts: {
    versions: number;
    /** Fecha local del inicio, o `null` si no se empezó. */
    executedOn: IsoDate | null;
    finished: boolean;
    sets: ScenarioSetFact[];
    notes: string[];
  };
}

export interface ScenarioWorld {
  db: SqlDatabase;
  repos: Repositories;
  scenarios: Scenario[];
  /** Contextos para probar permisos: Alex, otro entrenador sin clientes, Lucía y Marta. */
  contexts: {
    trainer: TrainerContext;
    otherTrainer: TrainerContext;
    lucia: ClientContext;
    marta: ClientContext;
  };
}

const TZ = 'Europe/Madrid';
const ANALYSIS_DAY: IsoDate = '2026-11-24';
const SEED_DAY: IsoDate = '2026-11-08';

const plusSeconds = (at: IsoDateTime, seconds: number) =>
  new Date(Date.parse(at) + seconds * 1000).toISOString();

function assertTestPath(path: string): void {
  if (path === ':memory:') return;
  const inside = resolve(path).startsWith(resolve(tmpdir()) + sep);
  if (!inside) {
    throw new Error(
      'Los escenarios de prueba solo se crean en memoria o en el directorio temporal.',
    );
  }
}

/** Ejercicio con los valores por defecto de la prueba (sentadilla goblet 3 × 10 · 16 kg · RIR 2). */
function item(id: string, order: number, patch: Partial<SessionItem> = {}): SessionItem {
  return {
    id,
    variantId: 'ex-goblet-squat',
    order,
    block: String.fromCharCode(64 + order),
    blockMode: 'sequential',
    sets: 3,
    defaults: {
      reps: { kind: 'fixed', reps: 10 },
      load: { kind: 'external', kg: 16, basis: 'total' },
      effort: { kind: 'rir', rir: 2 },
      restSeconds: 90,
    },
    perSet: [],
    ...patch,
  };
}

const defaults = (patch: Partial<SessionItem['defaults']>): SessionItem['defaults'] => ({
  reps: { kind: 'fixed', reps: 10 },
  load: { kind: 'none' },
  effort: { kind: 'none' },
  restSeconds: 60,
  ...patch,
});

export async function buildAnalysisScenarios(options: {
  /** Fija el reloj del servidor (en Vitest, `vi.setSystemTime`). */
  setClock: (at: IsoDateTime) => void;
  path?: string;
}): Promise<ScenarioWorld> {
  const path = options.path ?? ':memory:';
  assertTestPath(path);
  options.setClock(`${SEED_DAY}T07:00:00.000Z`);
  const { db, repos } = seededTestDatabase(SEED_DAY, { path, timeZone: TZ });

  const trainerAt = (today: IsoDate, trainerId = DEMO_TRAINER_ID): TrainerContext => ({
    actor: { role: 'trainer', trainerId } satisfies TrainerActor,
    today,
    timeZone: TZ,
    repos,
  });
  const clientAt = (today: IsoDate, clientId: string): ClientContext => ({
    actor: { role: 'client', clientId, trainerId: DEMO_TRAINER_ID } satisfies ClientActor,
    today,
    timeZone: TZ,
    repos,
  });
  const scenarios: Scenario[] = [];

  async function publish(
    key: ScenarioKey,
    plannedDate: IsoDate,
    label: string,
    items: SessionItem[],
    publishedAt: IsoDateTime,
  ): Promise<{ sessionId: string; content: SessionContent }> {
    options.setClock(publishedAt);
    const ctx = trainerAt(publishedAt.slice(0, 10));
    const sessionId = `s-escenario-${key}`;
    const created = await createSessionDraft(ctx, {
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate,
      label,
      title: `Escenario ${key}`,
      focus: 'Escenario de prueba',
      estimatedMinutes: 40,
    });
    if (!created.ok) throw new Error(`${key}: no se creó (${JSON.stringify(created)})`);
    const builder = (await getSessionBuilder(ctx, sessionId))!;
    const content: SessionContent = { ...builder.content, items };
    const published = await publishSession(ctx, {
      sessionId,
      expectedRevision: builder.revision,
      content,
    });
    if (!published.ok) throw new Error(`${key}: no se publicó (${JSON.stringify(published)})`);
    const version = (await repos.training.getVersion(sessionId, 1))!;
    return { sessionId, content: version.content };
  }

  async function change(
    sessionId: string,
    at: IsoDateTime,
    next: (content: SessionContent) => SessionContent,
    reason?: string,
  ): Promise<SessionContent> {
    options.setClock(at);
    const ctx = trainerAt(at.slice(0, 10));
    const started = await startSessionChange(ctx, sessionId);
    if (started !== 'started') throw new Error(`${sessionId}: cambio no iniciado (${started})`);
    const draft = (await repos.training.getSession(sessionId))!;
    const content = next(draft.draft!);
    const published = await publishSessionChange(ctx, {
      sessionId,
      expectedRevision: draft.draftRevision,
      content,
      ...(reason ? { reason } : {}),
    });
    if (!published.ok)
      throw new Error(`${sessionId}: cambio no publicado (${JSON.stringify(published)})`);
    const session = (await repos.training.getSession(sessionId))!;
    return (await repos.training.getVersion(sessionId, session.currentVersion!))!.content;
  }

  /** La clienta en su móvil: cada comando llega al servidor 30 s después (con conexión). */
  function client(key: string, sessionId: string, clientId = DEMO_NEW_CLIENT_ID) {
    let n = 0;
    const facts: ScenarioSetFact[] = [];
    const send = async (command: ClientCommand) => {
      options.setClock(plusSeconds(command.device.recordedAt, 30));
      const outcome = await executeClientCommand(
        clientAt(command.device.recordedAt.slice(0, 10), clientId),
        sessionId,
        command,
      );
      if (outcome.status !== 200) {
        throw new Error(
          `${key}: comando ${command.type} rechazado (${JSON.stringify(outcome.body)})`,
        );
      }
    };
    const base = (at: IsoDateTime) => ({
      commandId: `cmd-${key}-${String((n += 1)).padStart(3, '0')}`,
      clientId,
      device: { recordedAt: at, timeZone: TZ, utcOffsetMinutes: 60 },
    });
    return {
      facts,
      start: (at: IsoDateTime, versionNumber = 1) =>
        send({ ...base(at), type: 'start', versionNumber }),
      pause: (at: IsoDateTime) => send({ ...base(at), type: 'pause' }),
      resume: (at: IsoDateTime) => send({ ...base(at), type: 'resume' }),
      finish: (at: IsoDateTime, confirmEndEarly = false, comment: string | null = null) =>
        send({ ...base(at), type: 'finish', confirmEndEarly, comment }),
      /**
       * Registra una serie partiendo de lo que propone el reproductor (`defaultPerformed`, igual
       * que en el móvil) y aplicando lo que la clienta cambia o escribe.
       */
      set: async (
        at: IsoDateTime,
        content: SessionContent,
        prescriptionId: string,
        setNumber: number,
        versionNumber: number,
        change: Partial<PerformedSetInput> | 'not_done' = {},
      ) => {
        const target = resolveSets(content.items.find((i) => i.id === prescriptionId)!).find(
          (s) => s.setNumber === setNumber,
        )!;
        const proposed = defaultPerformed(target);
        const input: PerformedSetInput =
          change === 'not_done' ? { completed: false } : { ...proposed, ...change };
        const entry: EntryKind =
          change === 'not_done'
            ? 'not_done'
            : Object.keys(change).every((k) => k === 'rir' || k === 'rpe')
              ? Object.keys(change).length === 0
                ? 'proposed_unchanged'
                : 'proposed_plus_effort'
              : 'edited';
        facts.push({ prescriptionId, setNumber, versionNumber, entry });
        await send({
          ...base(at),
          type: 'log_set',
          versionNumber,
          prescriptionId,
          setNumber,
          supersedes: null,
          ...input,
        });
      },
    };
  }

  const kg = (value: number): Partial<PerformedSetInput> => ({
    load: { kind: 'external', kg: value } satisfies PerformedLoad,
  });

  // 1 · Completa: todo como se prescribió, con el RIR anotado.
  {
    const key = 'completa';
    const { sessionId, content } = await publish(
      key,
      '2026-11-09',
      'Mañana',
      [
        item('itm-goblet', 1),
        item('itm-plank', 2, {
          variantId: 'ex-side-plank',
          sets: 2,
          defaults: defaults({
            reps: { kind: 'seconds', seconds: 30 },
            load: { kind: 'bodyweight' },
          }),
        }),
      ],
      '2026-11-08T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-11-09T08:00:00.000Z');
    for (const s of [1, 2, 3]) {
      await c.set(`2026-11-09T08:0${s * 2}:00.000Z`, content, 'itm-goblet', s, 1, { rir: 2 });
    }
    await c.set('2026-11-09T08:10:00.000Z', content, 'itm-plank', 1, 1);
    await c.set('2026-11-09T08:12:00.000Z', content, 'itm-plank', 2, 1);
    await c.finish('2026-11-09T08:15:00.000Z');
    scenarios.push({
      key,
      title: 'Sesión completamente realizada',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-09',
      covers: ['AC-B3-01', 'AC-B3-05'],
      facts: { versions: 1, executedOn: '2026-11-09', finished: true, sets: c.facts, notes: [] },
    });
  }

  // 2 · Parcial: una serie «no realizada» y otra sin registrar; se termina antes.
  {
    const key = 'parcial';
    const { sessionId, content } = await publish(
      key,
      '2026-11-10',
      'Mañana',
      [
        item('itm-goblet', 1),
        item('itm-plank', 2, {
          variantId: 'ex-side-plank',
          sets: 2,
          defaults: defaults({
            reps: { kind: 'seconds', seconds: 30 },
            load: { kind: 'bodyweight' },
          }),
        }),
      ],
      '2026-11-09T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-11-10T08:00:00.000Z');
    await c.set('2026-11-10T08:02:00.000Z', content, 'itm-goblet', 1, 1, { rir: 2 });
    await c.set('2026-11-10T08:04:00.000Z', content, 'itm-goblet', 2, 1, { rir: 1 });
    await c.set('2026-11-10T08:06:00.000Z', content, 'itm-goblet', 3, 1, 'not_done');
    await c.set('2026-11-10T08:10:00.000Z', content, 'itm-plank', 1, 1);
    await c.finish('2026-11-10T08:15:00.000Z', true, 'Hoy no me encontraba bien');
    scenarios.push({
      key,
      title: 'Sesión parcial: una serie no realizada y otra sin registrar',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-10',
      covers: ['AC-B3-02'],
      facts: {
        versions: 1,
        executedOn: '2026-11-10',
        finished: true,
        sets: c.facts,
        notes: ['Plancha, serie 2: sin registrar al cerrar como parcial.'],
      },
    });
  }

  // 3 · Sin empezar: publicada para un día que ya pasó.
  {
    const key = 'sin-empezar';
    const { sessionId } = await publish(
      key,
      '2026-11-11',
      'Mañana',
      [item('itm-goblet', 1)],
      '2026-11-10T18:00:00.000Z',
    );
    scenarios.push({
      key,
      title: 'Sesión sin empezar',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-11',
      covers: ['P-117 (sin empezar)'],
      facts: { versions: 1, executedOn: null, finished: false, sets: [], notes: [] },
    });
  }

  // 4 · Varias versiones: v2 a media sesión (series 2 y 3 a 14 kg) y v3 después de terminar.
  {
    const key = 'versiones';
    const { sessionId, content: v1 } = await publish(
      key,
      '2026-11-12',
      'Mañana',
      [item('itm-goblet', 1)],
      '2026-11-11T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-11-12T08:00:00.000Z');
    await c.set('2026-11-12T08:02:00.000Z', v1, 'itm-goblet', 1, 1, { rir: 2 });
    const v2 = await change(sessionId, '2026-11-12T08:03:00.000Z', (draft) => ({
      ...draft,
      items: draft.items.map((i) => ({
        ...i,
        perSet: [2, 3].map((setNumber) => ({
          setNumber,
          load: { kind: 'external' as const, kg: 14, basis: 'total' as const },
        })),
      })),
    }));
    // La clienta aún tiene la v1 en pantalla: su serie 2 va con la v1.
    await c.set('2026-11-12T08:04:00.000Z', v1, 'itm-goblet', 2, 1, { rir: 2 });
    // Abre la v2: la serie 3 va con la v2 (14 kg propuestos).
    await c.set('2026-11-12T08:06:00.000Z', v2, 'itm-goblet', 3, 2, { rir: 2 });
    await c.finish('2026-11-12T08:10:00.000Z');
    // Después de terminar, las series registradas están bloqueadas: la v3 añade un ejercicio.
    await change(
      sessionId,
      '2026-11-12T20:00:00.000Z',
      (draft) => ({
        ...draft,
        items: [
          ...draft.items,
          item('itm-plank', 2, {
            variantId: 'ex-side-plank',
            sets: 2,
            defaults: defaults({
              reps: { kind: 'seconds', seconds: 30 },
              load: { kind: 'bodyweight' },
            }),
          }),
        ],
      }),
      'Ajuste para la próxima vez',
    );
    scenarios.push({
      key,
      title: 'Varias versiones: v2 a media sesión y v3 después de terminar',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-12',
      covers: ['AC-B3-07', 'P-92', 'P-117 (último registro)'],
      facts: {
        versions: 3,
        executedOn: '2026-11-12',
        finished: true,
        sets: c.facts,
        notes: [
          'La v3 se publicó después de terminar y añade una plancha: la vista original no la incluye; la vigente, sí.',
        ],
      },
    });
  }

  // 5 y 6 · Dos sesiones ejecutadas el mismo día: repeticiones distintas y rangos.
  {
    const key = 'repeticiones';
    const { sessionId, content } = await publish(
      key,
      '2026-11-13',
      'Mañana',
      [item('itm-goblet', 1)],
      '2026-11-12T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-11-13T08:00:00.000Z');
    await c.set('2026-11-13T08:02:00.000Z', content, 'itm-goblet', 1, 1, { rir: 2 });
    await c.set('2026-11-13T08:04:00.000Z', content, 'itm-goblet', 2, 1, { reps: 9, rir: 1 });
    await c.set('2026-11-13T08:06:00.000Z', content, 'itm-goblet', 3, 1, { reps: 11, rir: 2 });
    await c.finish('2026-11-13T08:10:00.000Z');
    scenarios.push({
      key,
      title: 'Repeticiones distintas de las previstas (10 · 9 · 11 frente a 10)',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-13',
      covers: ['AC-B3-03 (mismo día)', 'AC-B3-04'],
      facts: { versions: 1, executedOn: '2026-11-13', finished: true, sets: c.facts, notes: [] },
    });
  }
  {
    const key = 'rangos';
    const { sessionId, content } = await publish(
      key,
      '2026-11-13',
      'Tarde',
      [
        item('itm-front', 1, {
          variantId: 'ex-front-squat',
          defaults: defaults({
            reps: { kind: 'range', min: 8, max: 10 },
            load: { kind: 'external', kg: 20, basis: 'total' },
            effort: { kind: 'rir', rir: { min: 1, max: 3 } },
          }),
        }),
      ],
      '2026-11-12T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-11-13T17:00:00.000Z');
    await c.set('2026-11-13T17:02:00.000Z', content, 'itm-front', 1, 1, { reps: 9, rir: 2 });
    await c.set('2026-11-13T17:04:00.000Z', content, 'itm-front', 2, 1, { reps: 7, rir: 0 });
    await c.set('2026-11-13T17:06:00.000Z', content, 'itm-front', 3, 1, { reps: 11, rir: 4 });
    await c.finish('2026-11-13T17:10:00.000Z');
    scenarios.push({
      key,
      title: 'Rangos: 9 dentro, 7 por debajo y 11 por encima de 8–10 (y RIR 1–3)',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-13',
      covers: ['AC-B3-03 (mismo día)', 'AC-B3-04'],
      facts: { versions: 1, executedOn: '2026-11-13', finished: true, sets: c.facts, notes: [] },
    });
  }

  // 7 · Carga coincidente y distinta (40 · 37 · 42,5 frente a 40).
  {
    const key = 'cargas';
    const { sessionId, content } = await publish(
      key,
      '2026-11-14',
      'Mañana',
      [
        item('itm-bench', 1, {
          variantId: 'ex-bench-press',
          defaults: defaults({
            reps: { kind: 'fixed', reps: 8 },
            load: { kind: 'external', kg: 40, basis: 'total' },
            effort: { kind: 'rir', rir: 2 },
          }),
        }),
      ],
      '2026-11-13T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-11-14T09:00:00.000Z');
    await c.set('2026-11-14T09:02:00.000Z', content, 'itm-bench', 1, 1, { rir: 2 });
    await c.set('2026-11-14T09:04:00.000Z', content, 'itm-bench', 2, 1, { ...kg(37), rir: 3 });
    await c.set('2026-11-14T09:06:00.000Z', content, 'itm-bench', 3, 1, { ...kg(42.5), rir: 1 });
    await c.finish('2026-11-14T09:10:00.000Z');
    scenarios.push({
      key,
      title: 'Carga coincidente y distinta (40 · 37 · 42,5 kg frente a 40)',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-14',
      covers: ['AC-B3-04'],
      facts: { versions: 1, executedOn: '2026-11-14', finished: true, sets: c.facts, notes: [] },
    });
  }

  // 8 · RIR y RPE prescritos que no siempre se anotan.
  {
    const key = 'esfuerzo-ausente';
    const { sessionId, content } = await publish(
      key,
      '2026-11-15',
      'Mañana',
      [
        item('itm-goblet', 1),
        item('itm-row', 2, {
          variantId: 'ex-db-row',
          sets: 2,
          defaults: defaults({
            reps: { kind: 'fixed', reps: 10 },
            load: { kind: 'external', kg: 18, basis: 'total' },
            effort: { kind: 'rpe', rpe: 8, scale: 'rir_based' },
          }),
        }),
      ],
      '2026-11-14T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-11-15T10:00:00.000Z');
    await c.set('2026-11-15T10:02:00.000Z', content, 'itm-goblet', 1, 1);
    await c.set('2026-11-15T10:04:00.000Z', content, 'itm-goblet', 2, 1, { rir: 2 });
    await c.set('2026-11-15T10:06:00.000Z', content, 'itm-goblet', 3, 1);
    await c.set('2026-11-15T10:08:00.000Z', content, 'itm-row', 1, 1, { rpe: 8 });
    await c.set('2026-11-15T10:10:00.000Z', content, 'itm-row', 2, 1);
    await c.finish('2026-11-15T10:15:00.000Z');
    scenarios.push({
      key,
      title: 'RIR y RPE prescritos sin anotar en algunas series',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-15',
      covers: ['AC-B3-12'],
      facts: { versions: 1, executedOn: '2026-11-15', finished: true, sets: c.facts, notes: [] },
    });
  }

  // 9 · Trasladada: prevista el lunes 16 y hecha el martes 17.
  {
    const key = 'trasladada';
    const { sessionId, content } = await publish(
      key,
      '2026-11-16',
      'Mañana',
      [item('itm-goblet', 1, { sets: 1 })],
      '2026-11-15T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-11-17T17:00:00.000Z');
    await c.set('2026-11-17T17:02:00.000Z', content, 'itm-goblet', 1, 1, { rir: 2 });
    await c.finish('2026-11-17T17:05:00.000Z');
    scenarios.push({
      key,
      title: 'Prevista el lunes 16 y hecha el martes 17',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-16',
      covers: ['AC-B3-08', 'P-93'],
      facts: { versions: 1, executedOn: '2026-11-17', finished: true, sets: c.facts, notes: [] },
    });
  }

  // 10 · Medianoche: empieza a las 23:50 y registra a las 23:58 y a las 00:03 (hora de Madrid).
  {
    const key = 'medianoche';
    const { sessionId, content } = await publish(
      key,
      '2026-11-18',
      'Noche',
      [item('itm-goblet', 1, { sets: 2 })],
      '2026-11-17T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-11-18T22:50:00.000Z');
    await c.set('2026-11-18T22:58:00.000Z', content, 'itm-goblet', 1, 1, { rir: 2 });
    await c.set('2026-11-18T23:03:00.000Z', content, 'itm-goblet', 2, 1, { rir: 2 });
    await c.finish('2026-11-18T23:10:00.000Z');
    scenarios.push({
      key,
      title: 'Cruza la medianoche (23:50 → 00:10, hora de Madrid)',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-18',
      covers: ['AC-B3-09'],
      facts: { versions: 1, executedOn: '2026-11-18', finished: true, sets: c.facts, notes: [] },
    });
  }

  // 11 · Con una pausa registrada de 20 min.
  {
    const key = 'pausas';
    const { sessionId, content } = await publish(
      key,
      '2026-11-19',
      'Mañana',
      [item('itm-goblet', 1, { sets: 2 })],
      '2026-11-18T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-11-19T09:00:00.000Z');
    await c.set('2026-11-19T09:05:00.000Z', content, 'itm-goblet', 1, 1, { rir: 2 });
    await c.pause('2026-11-19T09:10:00.000Z');
    await c.resume('2026-11-19T09:30:00.000Z');
    await c.set('2026-11-19T09:35:00.000Z', content, 'itm-goblet', 2, 1, { rir: 2 });
    await c.finish('2026-11-19T09:40:00.000Z');
    scenarios.push({
      key,
      title: 'Pausa registrada de 20 min',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-19',
      covers: ['AC-B3-10 (con pausas)'],
      facts: {
        versions: 1,
        executedOn: '2026-11-19',
        finished: true,
        sets: c.facts,
        notes: ['Transcurrida 40 min; pausas 20 min; calculada 20 min.'],
      },
    });
  }

  // 12 · Hueco de 9 h 05 min sin pausa: P-116, «advertencia».
  {
    const key = 'hueco-advertencia';
    const { sessionId, content } = await publish(
      key,
      '2026-11-20',
      'Noche',
      [item('itm-goblet', 1, { sets: 1 })],
      '2026-11-19T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-11-20T20:00:00.000Z');
    await c.set('2026-11-20T20:10:00.000Z', content, 'itm-goblet', 1, 1, { rir: 2 });
    await c.finish('2026-11-21T05:15:00.000Z');
    scenarios.push({
      key,
      title: 'Hueco de 9 h 05 min sin pausa (advertencia)',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-20',
      covers: ['AC-B3-10', 'P-116 (advertencia)'],
      facts: { versions: 1, executedOn: '2026-11-20', finished: true, sets: c.facts, notes: [] },
    });
  }

  // 13 · Hueco de 45 min con 40 min de pausas registradas: P-116, «aviso».
  {
    const key = 'hueco-aviso';
    const { sessionId, content } = await publish(
      key,
      '2026-11-21',
      'Mañana',
      [item('itm-goblet', 1, { sets: 2 })],
      '2026-11-20T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-11-21T10:00:00.000Z');
    await c.set('2026-11-21T10:05:00.000Z', content, 'itm-goblet', 1, 1, { rir: 2 });
    await c.pause('2026-11-21T10:06:00.000Z');
    await c.resume('2026-11-21T10:46:00.000Z');
    await c.set('2026-11-21T10:50:00.000Z', content, 'itm-goblet', 2, 1, { rir: 2 });
    await c.finish('2026-11-21T10:55:00.000Z');
    scenarios.push({
      key,
      title: 'Hueco de 45 min con 40 min de pausas (aviso)',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-21',
      covers: ['P-116 (aviso)'],
      facts: {
        versions: 1,
        executedOn: '2026-11-21',
        finished: true,
        sets: c.facts,
        notes: ['La base solo guarda el total de pausas, no dónde ocurrieron.'],
      },
    });
  }

  // 14 · Valores propuestos: sin tocar, con el RIR escrito y editados.
  {
    const key = 'valores-propuestos';
    const { sessionId, content } = await publish(
      key,
      '2026-11-22',
      'Mañana',
      [item('itm-goblet', 1)],
      '2026-11-21T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-11-22T09:00:00.000Z');
    await c.set('2026-11-22T09:02:00.000Z', content, 'itm-goblet', 1, 1);
    await c.set('2026-11-22T09:04:00.000Z', content, 'itm-goblet', 2, 1, { rir: 2 });
    await c.set('2026-11-22T09:06:00.000Z', content, 'itm-goblet', 3, 1, { reps: 8, rir: 0 });
    await c.finish('2026-11-22T09:10:00.000Z');
    scenarios.push({
      key,
      title: 'Valores propuestos: sin tocar, con el RIR escrito y editados',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-22',
      covers: ['§5.4 (valores propuestos)', 'P-119'],
      facts: {
        versions: 1,
        executedOn: '2026-11-22',
        finished: true,
        sets: c.facts,
        notes: [
          'La base no distingue la serie 1 (propuesta sin tocar) de una confirmada: solo lo sabe este escenario.',
        ],
      },
    });
  }

  // 15 · Modalidades de carga y tipos de serie.
  {
    const key = 'modalidades';
    const items: SessionItem[] = [
      item('itm-pushup', 1, {
        variantId: 'ex-db-press',
        sets: 2,
        defaults: defaults({ load: { kind: 'bodyweight' } }),
      }),
      item('itm-pullup-plus', 2, {
        variantId: 'ex-pullup',
        sets: 2,
        defaults: defaults({
          reps: { kind: 'fixed', reps: 5 },
          load: { kind: 'bodyweight_plus', addedKg: 5 },
        }),
      }),
      item('itm-pullup-assisted', 3, {
        variantId: 'ex-pullup',
        sets: 2,
        defaults: defaults({
          reps: { kind: 'fixed', reps: 6 },
          load: { kind: 'assisted', assistanceKg: 20, via: 'machine' },
        }),
      }),
      item('itm-band', 4, {
        variantId: 'ex-band-row',
        sets: 2,
        defaults: defaults({
          reps: { kind: 'fixed', reps: 12 },
          load: { kind: 'elastic', descriptor: 'banda roja' },
        }),
      }),
      item('itm-device', 5, {
        variantId: 'ex-hip-thrust',
        sets: 2,
        defaults: defaults({
          reps: { kind: 'fixed', reps: 10 },
          load: { kind: 'device', setting: 'nivel 5' },
        }),
      }),
      item('itm-sled', 6, {
        variantId: 'ex-acceleration',
        sets: 2,
        defaults: defaults({
          reps: { kind: 'meters', meters: 20 },
          load: { kind: 'other', text: 'trineo con 2 discos de 20' },
        }),
      }),
      item('itm-implements', 7, {
        variantId: 'ex-db-press',
        sets: 3,
        defaults: defaults({
          reps: { kind: 'fixed', reps: 10 },
          load: { kind: 'external', kg: 20, basis: 'per_implement', implements: 2 },
        }),
      }),
      item('itm-per-side', 8, {
        variantId: 'ex-back-squat',
        sets: 2,
        defaults: defaults({
          reps: { kind: 'fixed', reps: 5 },
          load: { kind: 'external', kg: 20, basis: 'per_side' },
        }),
      }),
      item('itm-unilateral', 9, {
        variantId: 'ex-split-squat',
        sets: 2,
        defaults: defaults({
          reps: { kind: 'fixed', reps: 8, perSide: true },
          load: { kind: 'external', kg: 12, basis: 'total' },
        }),
      }),
      item('itm-self', 10, {
        variantId: 'ex-rdl',
        sets: 2,
        defaults: defaults({
          reps: { kind: 'fixed', reps: 8 },
          load: { kind: 'self_selected', guidance: 'la que te permita 2 en reserva' },
        }),
      }),
      item('itm-range-kg', 11, {
        variantId: 'ex-front-squat',
        sets: 2,
        defaults: defaults({
          reps: { kind: 'fixed', reps: 8 },
          load: { kind: 'external_range', minKg: 30, maxKg: 35, basis: 'total' },
        }),
      }),
      item('itm-iso', 12, {
        variantId: 'ex-iso-squat',
        sets: 2,
        defaults: defaults({
          reps: { kind: 'seconds', seconds: 45 },
          load: { kind: 'bodyweight' },
        }),
      }),
      item('itm-carry', 13, {
        variantId: 'ex-farmer-carry',
        sets: 2,
        defaults: defaults({
          reps: { kind: 'meters', meters: 30 },
          load: { kind: 'external', kg: 24, basis: 'per_implement', implements: 2 },
        }),
      }),
    ];
    const { sessionId, content } = await publish(
      key,
      '2026-11-23',
      'Mañana',
      items,
      '2026-11-22T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-11-23T09:00:00.000Z');
    let minute = 1;
    const at = () => `2026-11-23T09:${String((minute += 1)).padStart(2, '0')}:00.000Z`;
    for (const i of items) {
      for (let s = 1; s <= i.sets; s += 1) {
        const change: Partial<PerformedSetInput> =
          i.id === 'itm-pullup-assisted' && s === 2
            ? { load: { kind: 'assisted', assistanceKg: null } }
            : i.id === 'itm-self'
              ? { load: { kind: 'self_selected', descriptor: null, kg: 18 } }
              : i.id === 'itm-range-kg'
                ? kg(s === 1 ? 32.5 : 37.5)
                : {};
        await c.set(at(), content, i.id, s, 1, change);
      }
    }
    await c.finish(at());
    scenarios.push({
      key,
      title: 'Modalidades de carga y tipos de serie',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-23',
      covers: ['AC-B3-05', 'AC-B3-06', '§6.2'],
      facts: {
        versions: 1,
        executedOn: '2026-11-23',
        finished: true,
        sets: c.facts,
        notes: [
          'Asistida, serie 2: asistencia sin anotar (sin dato).',
          'Autoseleccionada: 18 kg anotados, sin base en la prescripción (P-115).',
          'Por lado: falta el peso de la barra (P-97). Repeticiones «por lado» (P-96).',
          'El %1RM no se incluye: necesita un 1RM de referencia que la base no tiene.',
        ],
      },
    });
  }

  // 16 · En curso: empezada, una serie y sin terminar.
  {
    const key = 'en-curso';
    const { sessionId, content } = await publish(
      key,
      ANALYSIS_DAY,
      'Mañana',
      [item('itm-goblet', 1)],
      '2026-11-23T18:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start(`${ANALYSIS_DAY}T08:00:00.000Z`);
    await c.set(`${ANALYSIS_DAY}T08:02:00.000Z`, content, 'itm-goblet', 1, 1, { rir: 2 });
    scenarios.push({
      key,
      title: 'Empezada y sin terminar',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: ANALYSIS_DAY,
      covers: ['§4.5 (sin terminar)', 'P-117 (sesión empezada)'],
      facts: { versions: 1, executedOn: ANALYSIS_DAY, finished: false, sets: c.facts, notes: [] },
    });
  }

  // 17 · Semana 53: el 1 de enero de 2027 a las 00:10 en Madrid cuenta en 2026-W53.
  {
    const key = 'semana-53';
    const { sessionId, content } = await publish(
      key,
      '2027-01-01',
      'Año nuevo',
      [item('itm-goblet', 1, { sets: 1 })],
      '2026-12-31T12:00:00.000Z',
    );
    const c = client(key, sessionId);
    await c.start('2026-12-31T23:10:00.000Z');
    await c.set('2026-12-31T23:15:00.000Z', content, 'itm-goblet', 1, 1, { rir: 2 });
    await c.finish('2026-12-31T23:20:00.000Z');
    scenarios.push({
      key,
      title: 'Primera hora del 1 de enero de 2027 (semana ISO 2026-W53)',
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2027-01-01',
      covers: ['AC-B3-14', 'P-94'],
      facts: { versions: 1, executedOn: '2027-01-01', finished: true, sets: c.facts, notes: [] },
    });
  }

  options.setClock(`${ANALYSIS_DAY}T12:00:00.000Z`);
  return {
    db,
    repos,
    scenarios,
    contexts: {
      trainer: trainerAt(ANALYSIS_DAY),
      // Un entrenador que no existe en la base: las políticas le niegan todo.
      otherTrainer: trainerAt(ANALYSIS_DAY, 't-otro-entrenador'),
      lucia: clientAt(ANALYSIS_DAY, DEMO_NEW_CLIENT_ID),
      marta: clientAt(ANALYSIS_DAY, DEMO_CLIENT_ID),
    },
  };
}
