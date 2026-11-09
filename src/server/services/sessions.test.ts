import { describe, expect, it } from 'vitest';
import { type ClientActor, type TrainerActor } from '@/domain/access';
import {
  normalizeContent,
  type SessionContent,
  type SessionItem,
} from '@/domain/training/session-v2';
import { type ClientContext, type DataMaintenance, type TrainerContext } from '../context';
import { seededTestDatabase } from '../db/test-support';
import { DEMO_CLIENT_ID, DEMO_NEW_CLIENT_ID, DEMO_TRAINER_ID } from '../repositories/demo/dataset';
import { type Repositories } from '../repositories/ports';
import { getClientSessionDetail, getClientToday } from './client-sessions';
import { backupDemoData, getDemoData, resetDemoData } from './demo-data';
import {
  createSessionDraft,
  deleteSessionDraft,
  getNewSessionForm,
  getPublishedSession,
  getSessionBuilder,
  getTrainerSessions,
  publishSession,
  publishSessionChange,
  reorderSessionDraft,
  saveSessionDraft,
  startSessionChange,
} from './trainer-sessions';

/**
 * Casos de uso de las sesiones v2 sobre SQLite real: B1-03, B1-04, B1-05 y B1-07, con los
 * intentos de acceso no autorizados (otro entrenador, otro cliente, borradores).
 */
const TODAY = '2026-11-04';
const TZ = 'Europe/Madrid';
const OTHER_TRAINER = 't-bea';
const OTHER_CLIENT = 'c-de-bea';

function setup() {
  const { db, repos } = seededTestDatabase(TODAY);
  // Un segundo entrenador ficticio con su clienta, SOLO en la base de pruebas (B1-04).
  db.exec(`INSERT INTO trainer (id, display_name) VALUES ('${OTHER_TRAINER}', 'Bea Ortiz')`);
  db.exec(`INSERT INTO client (id, trainer_id, display_name, status, population, goal, started_on, created_at)
    VALUES ('${OTHER_CLIENT}', '${OTHER_TRAINER}', 'Clara Soto', 'active', 'general_health', 'Fuerza',
      '2026-10-01', '2026-10-01T09:00:00.000Z')`);
  return { db, repos };
}

const trainer = (repos: Repositories, trainerId = DEMO_TRAINER_ID): TrainerContext => ({
  actor: { role: 'trainer', trainerId } satisfies TrainerActor,
  today: TODAY,
  timeZone: TZ,
  repos,
});
const client = (
  repos: Repositories,
  clientId = DEMO_NEW_CLIENT_ID,
  trainerId = DEMO_TRAINER_ID,
): ClientContext => ({
  actor: { role: 'client', clientId, trainerId } satisfies ClientActor,
  today: TODAY,
  timeZone: TZ,
  repos,
});

const item = (id: string, order: number, patch: Partial<SessionItem> = {}): SessionItem => ({
  id,
  variantId: 'ex-goblet-squat',
  order,
  block: `B${order}`,
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
});

/** Crea un borrador con el formulario A4 y lo completa con ejercicios (A5). */
async function createDraft(
  ctx: TrainerContext,
  patch: { label?: string; date?: string; title?: string; clientId?: string } = {},
) {
  const form = (await getNewSessionForm(ctx, patch.clientId ?? DEMO_NEW_CLIENT_ID))!;
  const created = await createSessionDraft(ctx, {
    sessionId: form.sessionId,
    clientId: form.clientId,
    plannedDate: patch.date ?? TODAY,
    label: patch.label ?? 'Mañana',
    title: patch.title ?? 'Fuerza · pierna',
    focus: 'Fuerza del tren inferior',
    estimatedMinutes: 45,
  });
  expect(created).toEqual({ ok: true, sessionId: form.sessionId });
  const builder = (await getSessionBuilder(ctx, form.sessionId))!;
  const content: SessionContent = {
    ...builder.content,
    items: [
      item('itm-a', 1, { privateNote: 'Vigilar la rodilla izquierda' }),
      item('itm-b', 2, { variantId: 'ex-rdl' }),
    ],
  };
  return { sessionId: form.sessionId, revision: builder.revision, content };
}

async function createPublished(ctx: TrainerContext, patch: Parameters<typeof createDraft>[1] = {}) {
  const draft = await createDraft(ctx, patch);
  const published = await publishSession(ctx, {
    sessionId: draft.sessionId,
    expectedRevision: draft.revision,
    content: draft.content,
  });
  expect(published).toEqual({ ok: true, version: 1, alreadyPublished: false });
  return draft;
}

describe('sesiones del entrenador (A3–A7)', () => {
  it('crear, guardar y publicar la versión 1 para Lucía; ella la ve en Hoy', async () => {
    const { repos } = setup();
    const ctx = trainer(repos);
    const { sessionId } = await createPublished(ctx);

    const view = (await getPublishedSession(ctx, sessionId))!;
    expect(view).toMatchObject({ title: 'Fuerza · pierna', label: 'Mañana', dayOrder: 1 });
    expect(view.version).toMatchObject({ number: 1, publishedBy: 'Alex Navarro' });
    expect(
      view.items.map((i) => [i.slot, i.name, i.setsAndReps, i.loadLabel, i.effortLabel]),
    ).toEqual([
      ['A1', 'Sentadilla goblet', '3 × 10', '16 kg', 'RIR 2'],
      ['B1', 'Peso muerto rumano', '3 × 10', '16 kg', 'RIR 2'],
    ]);
    expect(view.items[0]!.privateNote).toBe('Vigilar la rodilla izquierda');

    const today = await getClientToday(client(repos));
    expect(today.hero).toMatchObject({ id: sessionId, action: 'start', label: 'Mañana' });
    const detail = (await getClientSessionDetail(client(repos), sessionId))!;
    expect(detail.items).toHaveLength(2);
    // El cliente nunca recibe la nota privada.
    expect(JSON.stringify(detail)).not.toContain('Vigilar la rodilla');
  });

  it('B1-03 · dos sesiones el mismo día («Mañana» y «Tarde»), con su orden, en A3 y en Hoy', async () => {
    const { repos } = setup();
    const ctx = trainer(repos);
    const morning = await createPublished(ctx, { label: 'Mañana', title: 'Fuerza' });
    const evening = await createPublished(ctx, { label: 'Tarde', title: 'Movilidad' });
    await createPublished(ctx, { label: 'Club', date: '2026-11-06', title: 'Otro día' });

    const sessions = (await getTrainerSessions(ctx, DEMO_NEW_CLIENT_ID))!;
    const day = sessions.upcoming.find((d) => d.date === TODAY)!;
    expect(day.sessions.map((s) => [s.dayOrder, s.label, s.title, s.publication])).toEqual([
      [1, 'Mañana', 'Fuerza', 'published'],
      [2, 'Tarde', 'Movilidad', 'published'],
    ]);
    const today = await getClientToday(client(repos));
    expect(today.hero?.id).toBe(morning.sessionId);
    expect(today.alsoToday.map((s) => [s.id, s.label])).toEqual([[evening.sessionId, 'Tarde']]);
  });

  it('B1-07 · reenviar «Crear borrador» deja uno solo; publicar dos veces deja una versión', async () => {
    const { repos } = setup();
    const ctx = trainer(repos);
    const form = (await getNewSessionForm(ctx, DEMO_NEW_CLIENT_ID))!;
    const input = {
      sessionId: form.sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: TODAY,
      label: '',
      title: 'Fuerza',
      focus: '',
      estimatedMinutes: null,
    };
    expect(await createSessionDraft(ctx, input)).toEqual({ ok: true, sessionId: form.sessionId });
    expect(await createSessionDraft(ctx, input)).toEqual({ ok: true, sessionId: form.sessionId });
    expect(await repos.training.listSessions(DEMO_NEW_CLIENT_ID)).toHaveLength(1);

    const draft = await createDraft(ctx);
    const publish = () =>
      publishSession(ctx, {
        sessionId: draft.sessionId,
        expectedRevision: draft.revision,
        content: draft.content,
      });
    expect(await publish()).toEqual({ ok: true, version: 1, alreadyPublished: false });
    expect(await publish()).toEqual({ ok: true, version: 1, alreadyPublished: true });
    expect(await repos.training.listVersions(draft.sessionId)).toHaveLength(1);
  });

  it('B1-07 · guardar dos veces lo mismo no da conflicto; una revisión antigua con otro contenido sí', async () => {
    const { repos } = setup();
    const ctx = trainer(repos);
    const draft = await createDraft(ctx);
    const save = (revision: number, content: SessionContent) =>
      saveSessionDraft(ctx, { sessionId: draft.sessionId, expectedRevision: revision, content });
    const first = await save(draft.revision, draft.content);
    expect(first).toMatchObject({ ok: true, revision: draft.revision + 1, unchanged: false });
    expect(await save(draft.revision, draft.content)).toMatchObject({ ok: true, unchanged: true });
    expect(await save(draft.revision, { ...draft.content, title: 'Otra pestaña' })).toEqual({
      ok: false,
      reason: 'conflict',
      revision: draft.revision + 1,
    });
  });

  it('valida al guardar y al publicar, junto al campo', async () => {
    const { repos } = setup();
    const ctx = trainer(repos);
    const form = (await getNewSessionForm(ctx, DEMO_NEW_CLIENT_ID))!;
    const invalid = await createSessionDraft(ctx, {
      sessionId: form.sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-02-30',
      label: 'x'.repeat(41),
      title: '',
      focus: '',
      estimatedMinutes: 2,
    });
    expect(invalid.ok).toBe(false);
    expect(
      invalid.ok === false && invalid.reason === 'invalid' && invalid.issues.map((i) => i.path),
    ).toEqual(expect.arrayContaining(['plannedDate', 'label', 'title', 'estimatedMinutes']));

    const draft = await createDraft(ctx);
    const empty = await publishSession(ctx, {
      sessionId: draft.sessionId,
      expectedRevision: draft.revision,
      content: { ...draft.content, items: [] },
    });
    expect(empty).toMatchObject({ ok: false, reason: 'invalid' });
    const bad = await saveSessionDraft(ctx, {
      sessionId: draft.sessionId,
      expectedRevision: draft.revision,
      content: { ...draft.content, items: [item('x', 1, { sets: 0, variantId: 'no-existe' })] },
    });
    expect(bad.ok === false && bad.reason === 'invalid' && bad.issues.map((i) => i.path)).toEqual([
      'items.0.variantId',
      'items.0.sets',
    ]);
    // Un contenido sin forma reconocible no llega al dominio.
    expect(
      await saveSessionDraft(ctx, {
        sessionId: draft.sessionId,
        expectedRevision: 0,
        content: { a: 1 },
      }),
    ).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('solo se elimina un borrador que nunca se publicó; el orden se cambia entre borradores', async () => {
    const { repos } = setup();
    const ctx = trainer(repos);
    const a = await createDraft(ctx, { label: 'Mañana' });
    const b = await createDraft(ctx, { label: 'Tarde' });
    expect(await reorderSessionDraft(ctx, b.sessionId, 'up')).toBe('moved');
    let day = (await getTrainerSessions(ctx, DEMO_NEW_CLIENT_ID))!.upcoming[0]!.sessions;
    expect(day.map((s) => s.label)).toEqual(['Tarde', 'Mañana']);
    expect(day.map((s) => [s.canMoveUp, s.canMoveDown])).toEqual([
      [false, true],
      [true, false],
    ]);
    expect(await reorderSessionDraft(ctx, b.sessionId, 'up')).toBe('not_allowed');

    expect(await deleteSessionDraft(ctx, a.sessionId)).toBe('deleted');
    const published = await createPublished(ctx, { label: 'Club' });
    expect(await deleteSessionDraft(ctx, published.sessionId)).toBe('not_deletable');
    day = (await getTrainerSessions(ctx, DEMO_NEW_CLIENT_ID))!.upcoming[0]!.sessions;
    expect(day.map((s) => [s.label, s.canDelete])).toEqual([
      ['Tarde', true],
      ['Club', false],
    ]);
  });
});

describe('B1 · Hoy del cliente', () => {
  it('una sesión interrumpida otro día no desplaza a la de hoy: va a «De días anteriores»', async () => {
    // Un lunes, la semilla deja a medias la sesión de Marta del miércoles anterior.
    const monday = '2026-11-09';
    const { repos } = seededTestDatabase(monday);
    const home = await getClientToday({ ...client(repos, DEMO_CLIENT_ID), today: monday });
    expect(home.hero).toMatchObject({ id: `s-marta-${monday}`, action: 'start' });
    expect(home.earlier.map((s) => [s.id, s.execution.status])).toEqual([
      ['s-marta-2026-11-04', 'interrupted'],
    ]);
    expect(home.next).toBeNull();
    expect(home.week.planned).toBeGreaterThan(0);
  });
});

describe('B1-04 · clientes y entrenadores independientes', () => {
  it('Lucía no ve las sesiones de Marta, ni Marta las de Lucía; nadie ve los borradores', async () => {
    const { repos } = setup();
    const ctx = trainer(repos);
    const published = await createPublished(ctx);
    const draft = await createDraft(ctx, { label: 'Tarde' });

    const marta = client(repos, DEMO_CLIENT_ID);
    expect(await getClientSessionDetail(marta, published.sessionId)).toBeNull();
    const martaToday = await getClientToday(marta);
    expect(JSON.stringify(martaToday)).not.toContain(published.sessionId);

    const lucia = client(repos);
    expect(await getClientSessionDetail(lucia, draft.sessionId)).toBeNull();
    const martaSession = (await repos.training.listSessions(DEMO_CLIENT_ID))[0]!;
    expect(await getClientSessionDetail(lucia, martaSession.id)).toBeNull();
    expect(JSON.stringify(await getClientToday(lucia))).not.toContain('s-marta');
  });

  it('otro entrenador no puede leer ni editar las sesiones de Alex (y al revés)', async () => {
    const { repos } = setup();
    const alex = trainer(repos);
    const bea = trainer(repos, OTHER_TRAINER);
    const draft = await createDraft(alex);
    const published = await createPublished(alex, { label: 'Tarde' });

    expect(await getTrainerSessions(bea, DEMO_NEW_CLIENT_ID)).toBeNull();
    expect(await getNewSessionForm(bea, DEMO_NEW_CLIENT_ID)).toBeNull();
    expect(await getSessionBuilder(bea, draft.sessionId)).toBeNull();
    expect(await getPublishedSession(bea, published.sessionId)).toBeNull();
    expect(
      await saveSessionDraft(bea, {
        sessionId: draft.sessionId,
        expectedRevision: draft.revision,
        content: draft.content,
      }),
    ).toEqual({ ok: false, reason: 'not_found' });
    expect(
      await publishSession(bea, {
        sessionId: draft.sessionId,
        expectedRevision: draft.revision,
        content: draft.content,
      }),
    ).toEqual({ ok: false, reason: 'not_found' });
    expect(await deleteSessionDraft(bea, draft.sessionId)).toBe('not_found');
    expect(await reorderSessionDraft(bea, draft.sessionId, 'down')).toBe('not_found');
    expect(await startSessionChange(bea, published.sessionId)).toBe('not_found');
    // Crear para una clienta ajena, o reutilizar el identificador de una sesión ajena, tampoco.
    expect(
      await createSessionDraft(bea, {
        sessionId: draft.sessionId,
        clientId: OTHER_CLIENT,
        plannedDate: TODAY,
        label: '',
        title: 'Intento',
        focus: '',
        estimatedMinutes: null,
      }),
    ).toEqual({ ok: false, reason: 'not_found' });

    // Bea sí trabaja con su clienta, y Alex no la ve.
    const own = await createDraft(bea, { clientId: OTHER_CLIENT });
    expect(await getSessionBuilder(alex, own.sessionId)).toBeNull();
    expect(await getTrainerSessions(alex, OTHER_CLIENT)).toBeNull();
    // Y su clienta no ve lo de Lucía.
    expect(
      await getClientSessionDetail(client(repos, OTHER_CLIENT, OTHER_TRAINER), published.sessionId),
    ).toBeNull();
  });

  it('un cliente no puede gestionar los datos de la demostración', async () => {
    const { repos } = setup();
    const fake: DataMaintenance = {
      describe: () => {
        throw new Error('no debería llamarse');
      },
      backup: async () => {
        throw new Error('no debería llamarse');
      },
      reset: () => {
        throw new Error('no debería llamarse');
      },
    };
    const asClient = client(repos) as unknown as TrainerContext;
    expect(getDemoData(asClient, fake)).toBeNull();
    expect(await backupDemoData(asClient, fake)).toBeNull();
    expect(resetDemoData(asClient, fake)).toBeNull();
  });
});

describe('B1-05 · versiones en el modelo (servicio)', () => {
  it('se publica la v2 desde el servicio y la v1 no cambia; el cliente ve la nueva', async () => {
    const { repos } = setup();
    const ctx = trainer(repos);
    const { sessionId, content } = await createPublished(ctx);
    expect(await startSessionChange(ctx, sessionId)).toBe('started');
    const session = (await repos.training.getSession(sessionId))!;
    const v2: SessionContent = normalizeContent({
      ...content,
      items: [{ ...content.items[0]!, sets: 4 }, content.items[1]!],
    });
    const result = await publishSessionChange(ctx, {
      sessionId,
      expectedRevision: session.draftRevision,
      content: v2,
      reason: 'Una serie más',
    });
    expect(result).toEqual({ ok: true, version: 2, alreadyPublished: false });
    const versions = await repos.training.listVersions(sessionId);
    expect(versions.map((v) => [v.number, v.content.items[0]!.sets, v.executionState])).toEqual([
      [1, 3, 'not_started'],
      [2, 4, 'not_started'],
    ]);
    expect(versions[1]!.changes?.map((c) => c.text).join(' ')).toContain('3 → 4');
    const detail = (await getClientSessionDetail(client(repos), sessionId))!;
    expect(detail.items[0]!.sets).toBe(4);
    expect(detail.updatedBy).toBe('Alex');
  });

  it('con registros sembrados, las series registradas quedan bloqueadas y terminada exige motivo', async () => {
    const { repos } = setup();
    const ctx = trainer(repos);
    const marta = await repos.training.listSessions(DEMO_CLIENT_ID);
    let target = null;
    for (const s of marta) {
      const execution = await repos.training.getExecution(s.id);
      if (execution?.log.finishedAt && execution.setLogs.length > 0) {
        target = { session: s, execution };
        break;
      }
    }
    expect(target).not.toBeNull();
    const { session, execution } = target!;
    expect(await startSessionChange(ctx, session.id)).toBe('started');
    const draft = (await repos.training.getSession(session.id))!;
    const base = draft.draft!;
    const loggedItem = execution.setLogs[0]!.prescriptionId;

    // Cambiar la carga de un ejercicio con series registradas: bloqueado.
    const touchLogged = normalizeContent({
      ...base,
      items: base.items.map((i) =>
        i.id === loggedItem
          ? { ...i, defaults: { ...i.defaults, restSeconds: i.defaults.restSeconds + 15 } }
          : i,
      ),
    });
    const locked = await publishSessionChange(ctx, {
      sessionId: session.id,
      expectedRevision: draft.draftRevision,
      content: touchLogged,
      reason: 'Ajuste',
    });
    expect(
      locked.ok === false &&
        locked.reason === 'invalid' &&
        locked.issues.some((i) => /ya está registrada/.test(i.message)),
    ).toBe(true);

    // Quitar ese ejercicio: bloqueado.
    const removeLogged = normalizeContent({
      ...base,
      items: base.items.filter((i) => i.id !== loggedItem),
    });
    const removed = await publishSessionChange(ctx, {
      sessionId: session.id,
      expectedRevision: draft.draftRevision,
      content: removeLogged,
      reason: 'Ajuste',
    });
    expect(
      removed.ok === false &&
        removed.reason === 'invalid' &&
        removed.issues.some((i) => /no se puede quitar/.test(i.message)),
    ).toBe(true);

    // Un cambio que no toca lo registrado (la nota para el cliente) sin motivo: lo exige.
    const noteOnly = normalizeContent({ ...base, coachNote: 'Buen trabajo' });
    const noReason = await publishSessionChange(ctx, {
      sessionId: session.id,
      expectedRevision: draft.draftRevision,
      content: noteOnly,
    });
    expect(
      noReason.ok === false && noReason.reason === 'invalid' && noReason.issues.map((i) => i.path),
    ).toEqual(['reason']);
    const withReason = await publishSessionChange(ctx, {
      sessionId: session.id,
      expectedRevision: draft.draftRevision,
      content: noteOnly,
      reason: 'Nota para la clienta',
    });
    expect(withReason).toEqual({ ok: true, version: 2, alreadyPublished: false });
    const v2 = (await repos.training.getVersion(session.id, 2))!;
    expect(v2).toMatchObject({ executionState: 'finished', reason: 'Nota para la clienta' });
    // Los registros siguen ligados a la versión 1.
    const after = (await repos.training.getExecution(session.id))!;
    expect(after.setLogs.every((s) => s.versionNumber === 1)).toBe(true);
  });
});
