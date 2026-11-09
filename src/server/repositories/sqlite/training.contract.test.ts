import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  normalizeContent,
  type SessionContent,
  type SessionItem,
  type TrainingSession,
} from '@/domain/training/session-v2';
import { seededTestDatabase } from '../../db/test-support';
import { constraintKind } from '../../db/sqlite.ts';
import { DEMO_CLIENT_ID, DEMO_NEW_CLIENT_ID, DEMO_TRAINER_ID } from '../demo/dataset';
import { type PublishInput } from '../ports';

/**
 * Contrato del puerto `TrainingRepository` contra el adaptador SQLite (docs/V1_SPEC.md §8.3.4):
 * transacciones, idempotencia, conflictos de revisión e inmutabilidad de las versiones.
 * El adaptador de PostgreSQL tendrá que pasar las mismas pruebas.
 */
const TODAY = '2026-11-04';
const NOW = '2026-11-04T10:00:00.000Z';

const item = (id: string, order: number, patch: Partial<SessionItem> = {}): SessionItem => ({
  id,
  variantId: 'ex-goblet-squat',
  order,
  block: '',
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

const content = (patch: Partial<SessionContent> = {}): SessionContent =>
  normalizeContent({
    schema: 1,
    plannedDate: '2026-11-10',
    dayOrder: 1,
    label: 'Mañana',
    title: 'Fuerza · pierna',
    focus: 'Fuerza',
    estimatedMinutes: 45,
    items: [item('itm-a', 1), item('itm-b', 2, { variantId: 'ex-rdl' })],
    ...patch,
  });

const draft = (id: string, patch: Partial<TrainingSession> = {}): TrainingSession => ({
  id,
  clientId: DEMO_NEW_CLIENT_ID,
  trainerId: DEMO_TRAINER_ID,
  plannedDate: '2026-11-10',
  dayOrder: 1,
  label: 'Mañana',
  status: 'draft',
  currentVersion: null,
  draft: content(),
  draftBaseVersion: null,
  draftRevision: 0,
  createdAt: NOW,
  updatedAt: NOW,
  ...patch,
});

const publishInput = (sessionId: string, patch: Partial<PublishInput> = {}): PublishInput => ({
  sessionId,
  expectedRevision: 0,
  content: content(),
  versionId: `ver-${sessionId}-1`,
  publishedAt: NOW,
  publishedBy: DEMO_TRAINER_ID,
  changes: null,
  executionState: 'not_started',
  ...patch,
});

describe('TrainingRepository (SQLite)', () => {
  it('crear un borrador es idempotente: el reenvío con el mismo identificador no crea otro', async () => {
    const { repos, db } = seededTestDatabase(TODAY);
    expect(await repos.training.createDraft(draft('ses-1'))).toBe('created');
    expect(await repos.training.createDraft(draft('ses-1'))).toBe('exists');
    const count = db
      .prepare("SELECT COUNT(*) AS n FROM session WHERE id = 'ses-1'")
      .get<{ n: number }>()!.n;
    expect(count).toBe(1);
  });

  it('guardar con revisión: igual contenido no da conflicto; una revisión antigua con otro sí', async () => {
    const { repos } = seededTestDatabase(TODAY);
    await repos.training.createDraft(draft('ses-1'));
    const changed = content({ title: 'Fuerza · pierna (v2)' });
    const save = (expectedRevision: number, c: SessionContent) =>
      repos.training.saveDraft({
        sessionId: 'ses-1',
        expectedRevision,
        content: c,
        updatedAt: NOW,
      });

    expect(await save(0, changed)).toEqual({ result: 'saved', revision: 1 });
    // El mismo guardado reenviado (revisión 0 de nuevo): ya estaba aplicado.
    expect(await save(0, changed)).toEqual({ result: 'unchanged', revision: 1 });
    // Otra pestaña con la revisión 0 y otro contenido: conflicto, no se pisa.
    expect(await save(0, content({ title: 'Otra cosa' }))).toEqual({
      result: 'conflict',
      revision: 1,
    });
    expect((await repos.training.getSession('ses-1'))!.draft!.title).toBe('Fuerza · pierna (v2)');
    expect(
      await repos.training.saveDraft({
        sessionId: 'no-existe',
        expectedRevision: 0,
        content: changed,
        updatedAt: NOW,
      }),
    ).toEqual({ result: 'not_found' });
  });

  it('mientras no se publica, la fecha, el orden y el contexto visibles son los del borrador', async () => {
    const { repos } = seededTestDatabase(TODAY);
    await repos.training.createDraft(draft('ses-1'));
    await repos.training.saveDraft({
      sessionId: 'ses-1',
      expectedRevision: 0,
      content: content({ plannedDate: '2026-11-12', dayOrder: 2, label: 'Tarde' }),
      updatedAt: NOW,
    });
    expect(await repos.training.getSession('ses-1')).toMatchObject({
      plannedDate: '2026-11-12',
      dayOrder: 2,
      label: 'Tarde',
      status: 'draft',
      draftRevision: 1,
    });
  });

  it('publicar crea la versión 1; publicar dos veces no crea dos versiones', async () => {
    const { repos } = seededTestDatabase(TODAY);
    await repos.training.createDraft(draft('ses-1'));
    const first = await repos.training.publish(publishInput('ses-1'));
    expect(first.result).toBe('published');
    const retry = await repos.training.publish(publishInput('ses-1', { versionId: 'otra' }));
    expect(retry.result).toBe('already_published');
    expect(await repos.training.listVersions('ses-1')).toHaveLength(1);
    expect(await repos.training.getSession('ses-1')).toMatchObject({
      status: 'published',
      currentVersion: 1,
      draft: null,
    });
    // Con otro contenido y sin borrador, no es un reintento: no hay nada que publicar.
    const other = await repos.training.publish(
      publishInput('ses-1', { content: content({ title: 'Distinta' }) }),
    );
    expect(other.result).toBe('no_draft');
  });

  it('publicar con una revisión antigua da conflicto', async () => {
    const { repos } = seededTestDatabase(TODAY);
    await repos.training.createDraft(draft('ses-1'));
    await repos.training.saveDraft({
      sessionId: 'ses-1',
      expectedRevision: 0,
      content: content({ title: 'Nuevo' }),
      updatedAt: NOW,
    });
    expect(await repos.training.publish(publishInput('ses-1'))).toEqual({
      result: 'conflict',
      revision: 1,
    });
    expect(await repos.training.listVersions('ses-1')).toEqual([]);
  });

  it('solo se borran los borradores que nunca se han publicado', async () => {
    const { repos } = seededTestDatabase(TODAY);
    await repos.training.createDraft(draft('ses-1'));
    await repos.training.createDraft(draft('ses-2', { dayOrder: 2, label: 'Tarde' }));
    await repos.training.publish(publishInput('ses-2', { versionId: 'ver-ses-2-1' }));
    expect(await repos.training.deleteDraft('ses-1')).toBe('deleted');
    expect(await repos.training.getSession('ses-1')).toBeNull();
    expect(await repos.training.deleteDraft('ses-2')).toBe('not_deletable');
    expect(await repos.training.deleteDraft('ses-1')).toBe('not_found');
  });

  it('varias sesiones del mismo cliente el mismo día, cada una con su orden y su contexto', async () => {
    const { repos } = seededTestDatabase(TODAY);
    await repos.training.createDraft(draft('ses-tarde', { dayOrder: 2, label: 'Tarde' }));
    await repos.training.createDraft(draft('ses-manana'));
    await repos.training.createDraft(draft('ses-otro-dia', { plannedDate: '2026-11-11' }));
    const sessions = await repos.training.listSessions(DEMO_NEW_CLIENT_ID);
    expect(sessions.map((s) => [s.plannedDate, s.dayOrder, s.label])).toEqual([
      ['2026-11-10', 1, 'Mañana'],
      ['2026-11-10', 2, 'Tarde'],
      ['2026-11-11', 1, 'Mañana'],
    ]);
    const range = await repos.training.listSessions(DEMO_NEW_CLIENT_ID, {
      from: '2026-11-10',
      to: '2026-11-10',
    });
    expect(range.map((s) => s.id)).toEqual(['ses-manana', 'ses-tarde']);
  });

  it('el orden en el día se intercambia solo entre borradores sin publicar del mismo día', async () => {
    const { repos } = seededTestDatabase(TODAY);
    await repos.training.createDraft(draft('ses-1'));
    await repos.training.createDraft(draft('ses-2', { dayOrder: 2, label: 'Tarde' }));
    await repos.training.createDraft(draft('ses-otro-dia', { plannedDate: '2026-11-11' }));
    expect(await repos.training.swapDraftOrder('ses-1', 'ses-2', NOW)).toBe('swapped');
    const day = await repos.training.listSessions(DEMO_NEW_CLIENT_ID, {
      from: '2026-11-10',
      to: '2026-11-10',
    });
    expect(day.map((s) => [s.id, s.dayOrder, s.draft!.dayOrder])).toEqual([
      ['ses-2', 1, 1],
      ['ses-1', 2, 2],
    ]);
    expect(await repos.training.swapDraftOrder('ses-1', 'ses-otro-dia', NOW)).toBe('not_allowed');
    await repos.training.publish(
      publishInput('ses-2', { expectedRevision: 1, content: day[0]!.draft! }),
    );
    expect(await repos.training.swapDraftOrder('ses-1', 'ses-2', NOW)).toBe('not_allowed');
  });

  it('la versión 2 se publica aparte y la 1 no cambia; las versiones son inmutables', async () => {
    const { repos, db } = seededTestDatabase(TODAY);
    await repos.training.createDraft(draft('ses-1'));
    await repos.training.publish(publishInput('ses-1'));
    expect(await repos.training.startChangeDraft('ses-1', NOW)).toBe('started');
    expect(await repos.training.startChangeDraft('ses-1', NOW)).toBe('exists');
    const session = (await repos.training.getSession('ses-1'))!;
    expect(session).toMatchObject({ status: 'published', currentVersion: 1, draftBaseVersion: 1 });

    const v2 = content({ title: 'Fuerza · pierna (ajustada)' });
    const result = await repos.training.publish(
      publishInput('ses-1', {
        expectedRevision: session.draftRevision,
        content: v2,
        versionId: 'ver-ses-1-2',
        reason: 'Menos volumen',
        changes: [{ text: 'Título: … → …' }],
      }),
    );
    expect(result.result).toBe('published');
    const versions = await repos.training.listVersions('ses-1');
    expect(versions.map((v) => [v.number, v.content.title])).toEqual([
      [1, 'Fuerza · pierna'],
      [2, 'Fuerza · pierna (ajustada)'],
    ]);
    expect(versions[1]).toMatchObject({
      reason: 'Menos volumen',
      changes: [{ text: 'Título: … → …' }],
    });

    const attempt = (sql: string) => {
      try {
        db.exec(sql);
        return null;
      } catch (error) {
        return constraintKind(error);
      }
    };
    expect(attempt("UPDATE session_version SET content = '{}' WHERE session_id = 'ses-1'")).toBe(
      'trigger',
    );
    expect(attempt("DELETE FROM session_version WHERE session_id = 'ses-1'")).toBe('trigger');
    expect((await repos.training.getVersion('ses-1', 1))!.content.title).toBe('Fuerza · pierna');
  });

  it('descartar un borrador de cambios deja la versión vigente como estaba', async () => {
    const { repos } = seededTestDatabase(TODAY);
    await repos.training.createDraft(draft('ses-1'));
    await repos.training.publish(publishInput('ses-1'));
    await repos.training.startChangeDraft('ses-1', NOW);
    expect(await repos.training.discardChangeDraft('ses-1', NOW)).toBe('discarded');
    expect(await repos.training.getSession('ses-1')).toMatchObject({
      currentVersion: 1,
      draft: null,
      draftBaseVersion: null,
    });
    expect(await repos.training.discardChangeDraft('ses-1', NOW)).toBe('not_found');
  });

  it('las sesiones sembradas son la versión 1 publicada, con sus registros por serie', async () => {
    const { repos } = seededTestDatabase(TODAY);
    const marta = await repos.training.listSessions(DEMO_CLIENT_ID);
    expect(marta.length).toBeGreaterThan(0);
    expect(marta.every((s) => s.status === 'published' && s.currentVersion === 1)).toBe(true);
    const done = marta.find((s) => s.plannedDate < TODAY)!;
    const execution = await repos.training.getExecution(done.id);
    expect(execution?.setLogs.length).toBeGreaterThan(0);
    expect(execution?.setLogs.every((s) => s.versionNumber === 1 && s.completed)).toBe(true);
    expect(await repos.training.listSessions(DEMO_NEW_CLIENT_ID)).toEqual([]);
  });

  describe('en un archivo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trainpro-contrato-'));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it('lo guardado se recupera al cerrar y volver a abrir la base', async () => {
      const path = join(dir, 'persistencia.sqlite');
      const first = seededTestDatabase(TODAY, { path });
      await first.repos.training.createDraft(draft('ses-1'));
      await first.repos.training.publish(publishInput('ses-1'));
      first.db.close();

      const reopened = seededTestDatabase(TODAY, { path });
      expect(reopened.seedDate).toBe(TODAY);
      expect(await reopened.repos.training.getSession('ses-1')).toMatchObject({
        status: 'published',
        currentVersion: 1,
      });
      expect((await reopened.repos.training.getVersion('ses-1', 1))!.content).toEqual(content());
      reopened.db.close();
    });
  });
});
