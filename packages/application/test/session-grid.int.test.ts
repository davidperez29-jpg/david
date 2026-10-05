import { schema } from '@tp/db';
import { addDays, isoWeekday, localDate, parseSessionTsv } from '@tp/domain';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  addSessionExercises,
  createExercise,
  createPlanFromTemplate,
  deleteSessionExercises,
  duplicateSessionExercises,
  getPlan,
  getSession,
  listClientAudit,
  listPlanTemplates,
  resolveExerciseNames,
  type PlanDetail,
  type SessionDetail,
} from '../src';
import { buildOrg } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
let sessionId: string;
const today = localDate(new Date());
const monday = addDays(today, 8 - isoWeekday(today));
const weeksOf = (p: PlanDetail) => p.phases.flatMap((ph) => ph.mesocycles.flatMap((m) => m.weeks));
const rowsOf = (s: SessionDetail) => s.blocks.flatMap((b) => b.exercises);

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  const tpl = (await listPlanTemplates(o.admin)).find((t) => t.slug === 'hipertrofia-3d')!;
  const plan = await createPlanFromTemplate(o.admin, o.clientA, {
    templateId: tpl.id,
    startDate: monday,
    weekdays: [1, 3, 5],
  });
  sessionId = weeksOf(await getPlan(o.admin, plan.id))[0]!.sessions[0]!.id;
});

describe('recognizing names typed or pasted in the table', () => {
  it('exact names and aliases; a clear typo; candidates when unsure; never another org', async () => {
    const mine = await createExercise(other.admin, { name: `Ejercicio privado ${other.tag}` });
    const r = await resolveExerciseNames(o.admin, {
      names: [
        'sentadilla trasera con barra',
        'Back squat',
        'Curl nordico',
        'Prensa 45',
        'Sentadila frontal con barra',
        'Remo',
        `Ejercicio privado ${other.tag}`,
      ],
    });
    expect(r[0]!.match?.name).toBe('Sentadilla trasera con barra');
    expect(r[1]!.match?.name).toBe('Sentadilla trasera con barra');
    expect(r[2]!.match?.name).toBe('Curl nórdico');
    expect(r[3]!.match?.name).toBe('Prensa 45º');
    expect(r[4]!.match?.name).toBe('Sentadilla frontal con barra');
    expect(r[5]!.match).toBeNull();
    expect(r[5]!.candidates.length).toBeGreaterThan(0);
    expect(r[6]!.match).toBeNull();
    expect(r[6]!.candidates.map((c) => c.id)).not.toContain(mine.id);
  });
});

describe('pasting rows into a session', () => {
  it('five pasted rows become five exercises at the end, in order, audited', async () => {
    const pasted = parseSessionTsv(
      [
        'EJERCICIO\tSERIES\tREPS\tCARGA\tRIR\tDESC.\tNOTAS',
        'Sentadilla trasera con barra\t4\t6-8\t80 kg\t2\t2:30\tbajar controlado',
        'Curl nórdico\t3\t5\tPC\t\t2 min\t',
        'Prensa 45º\t3\t10-12\t120\t1-2\t90\t',
        'Plancha frontal\t3\t30 s\t\t\t60\t',
        'Sentadilla goblet con KB\t2\t12\t16 kg\t3\t60\t',
      ].join('\n'),
    );
    const names = await resolveExerciseNames(o.admin, { names: pasted.map((p) => p.exercise) });
    expect(names.every((n) => n.match)).toBe(true);
    const before = rowsOf(await getSession(o.admin, sessionId));
    const r = await addSessionExercises(o.admin, sessionId, {
      rows: pasted.map((p, i) => ({
        exerciseId: names[i]!.match!.id,
        prescription: p.prescription,
        notesForClient: p.notes,
      })),
    });
    expect(r.ids).toHaveLength(5);
    const after = await getSession(o.admin, sessionId);
    const rows = rowsOf(after);
    expect(rows).toHaveLength(before.length + 5);
    const added = rows.slice(-5);
    expect(added.map((x) => x.exercise.name)).toEqual(names.map((n) => n.match!.name));
    expect(added[0]!.prescription).toMatchObject({
      sets: 4,
      repsMin: 6,
      repsMax: 8,
      loadKg: 80,
      rirMin: 2,
      restS: 150,
    });
    expect(added[0]!.notesForClient).toBe('bajar controlado');
    expect(added[1]!.prescription.intensityNote).toBe('Peso corporal');
    expect(added[3]!.prescription.durationS).toBe(30);
    // Categories of the exercise come with each row (§11).
    expect(added[1]!.categories).toContain('Excéntricos');
    const block = after.blocks.find((b) => b.id === r.blockId)!;
    expect(block.exercises.map((x) => x.position)).toEqual(block.exercises.map((_, i) => i + 1));
    const audit = await listClientAudit(o.admin, o.clientA);
    const pastedAudit = audit.filter(
      (a) =>
        a.entityType === 'session_exercise' &&
        a.action === 'create' &&
        (a.changes as { pasted?: boolean } | null)?.pasted,
    );
    expect(pastedAudit).toHaveLength(5);
  });

  it('one invalid row: nothing is added and the error names the row and the field', async () => {
    const before = rowsOf(await getSession(o.admin, sessionId)).length;
    const [sq] = await resolveExerciseNames(o.admin, { names: ['Sentadilla trasera con barra'] });
    const err = await addSessionExercises(o.admin, sessionId, {
      rows: [
        { exerciseId: sq!.match!.id, prescription: { sets: 3, repsMin: 8, repsMax: 8 } },
        { exerciseId: sq!.match!.id, prescription: { rirMin: 2, rirMax: 2, rpeTarget: 8 } },
      ],
    }).catch((e) => e);
    expect(err).toMatchObject({ code: 'validation' });
    expect(Object.keys(err.details)).toContain('rows.1.rpeTarget');
    expect(rowsOf(await getSession(o.admin, sessionId))).toHaveLength(before);
  });

  it("refuses another organization's exercise, another session's block and other trainers", async () => {
    const foreign = await createExercise(other.admin, { name: `Ajeno ${other.tag}` });
    await expect(
      addSessionExercises(o.admin, sessionId, { rows: [{ exerciseId: foreign.id }] }),
    ).rejects.toMatchObject({ code: 'validation', details: { 'rows.0.exerciseId': ['unknown'] } });
    const s = await getSession(o.admin, sessionId);
    const [sq] = await resolveExerciseNames(o.admin, { names: ['Sentadilla trasera con barra'] });
    const [otherBlock] = await o.ctx.db
      .select({ id: schema.sessionBlocks.id })
      .from(schema.sessionBlocks)
      .innerJoin(schema.sessions, eq(schema.sessions.id, schema.sessionBlocks.sessionId))
      .where(eq(schema.sessions.clientId, o.clientA))
      .limit(50)
      .then((bs) => bs.filter((b) => !s.blocks.some((x) => x.id === b.id)));
    await expect(
      addSessionExercises(o.admin, sessionId, {
        blockId: otherBlock!.id,
        rows: [{ exerciseId: sq!.match!.id }],
      }),
    ).rejects.toMatchObject({ code: 'validation', details: { blockId: ['other_session'] } });
    // Trainer 2 is not assigned to client A; the other organization does not see it at all.
    await expect(
      addSessionExercises(o.trainer2, sessionId, { rows: [{ exerciseId: sq!.match!.id }] }),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      addSessionExercises(other.admin, sessionId, { rows: [{ exerciseId: sq!.match!.id }] }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('duplicating and deleting rows', () => {
  it('duplicates copy everything right below each row; deleting several renumbers', async () => {
    const s = await getSession(o.admin, sessionId);
    const block = s.blocks.find((b) => b.exercises.length >= 2)!;
    const [a, b] = block.exercises;
    const { ids } = await duplicateSessionExercises(o.admin, { ids: [a!.id, b!.id] });
    expect(ids).toHaveLength(2);
    const after = (await getSession(o.admin, sessionId)).blocks.find((x) => x.id === block.id)!;
    const order = after.exercises.map((x) => x.id);
    expect(order.indexOf(ids[0]!)).toBe(order.indexOf(a!.id) + 1);
    expect(order.indexOf(ids[1]!)).toBe(order.indexOf(b!.id) + 1);
    const copy = after.exercises.find((x) => x.id === ids[0])!;
    expect(copy.prescription).toEqual(a!.prescription);
    expect(copy.exercise.id).toBe(a!.exercise.id);
    expect(after.exercises.map((x) => x.position)).toEqual(after.exercises.map((_, i) => i + 1));

    await deleteSessionExercises(o.admin, { ids });
    const back = (await getSession(o.admin, sessionId)).blocks.find((x) => x.id === block.id)!;
    expect(back.exercises.map((x) => x.id)).toEqual(block.exercises.map((x) => x.id));
    expect(back.exercises.map((x) => x.position)).toEqual(back.exercises.map((_, i) => i + 1));
  });

  it("deleting with another client's row deletes nothing", async () => {
    const s = await getSession(o.admin, sessionId);
    const mine = rowsOf(s)[0]!;
    const tpl = (await listPlanTemplates(other.admin)).find((t) => t.slug === 'hipertrofia-3d')!;
    const plan = await createPlanFromTemplate(other.admin, other.clientA, {
      templateId: tpl.id,
      startDate: monday,
      weekdays: [1, 3, 5],
    });
    const theirSession = weeksOf(await getPlan(other.admin, plan.id))[0]!.sessions[0]!.id;
    const theirs = rowsOf(await getSession(other.admin, theirSession))[0]!;
    await expect(
      deleteSessionExercises(o.admin, { ids: [mine.id, theirs.id] }),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(rowsOf(await getSession(o.admin, sessionId)).map((x) => x.id)).toContain(mine.id);
    expect(rowsOf(await getSession(other.admin, theirSession)).map((x) => x.id)).toContain(
      theirs.id,
    );
  });
});
