import 'dotenv/config';
import { bindActor, createDb, RLS_POLICIES, type DbHandle, type RlsActor } from '@tp/db';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * RLS matrix (MASTER_SPECIFICATION §15.1: "todas las políticas RLS con test positivo y negativo").
 *
 * Runs on the demo database (pnpm db:reset && pnpm db:seed:demo), which fills almost every table,
 * with raw SQL as the runtime role, every statement in a transaction that is rolled back. For each
 * table in the RLS map, from its policy kind and its columns:
 *
 * - positive: ADMIN reads (and updates) every row of their organization; the assigned trainer reads
 *   every row of their client; the client reads (and, where allowed, writes) their own rows;
 * - negative: an ADMIN of another organization, another client and an unassigned trainer see and
 *   change nothing of the victim; the client cannot write staff data nor read staff-only data.
 *
 * Tables of the same kind get the same generated policy (rls.int.test.ts checks the migration
 * against the generator), so the last test requires every kind, and every custom policy, to be
 * exercised on at least one table that has data.
 */
const URL = process.env.DATABASE_URL;
let h: DbHandle;

type Actors = Record<
  'adminA' | 'trainerAssigned' | 'trainerOther' | 'victim' | 'otherClient' | 'adminB',
  RlsActor
>;
let A: Actors;
let orgA: string;
let victimClient: string;
const columns = new Map<string, Set<string>>();
const firstCol = new Map<string, string>();

class Rollback extends Error {}
const DENIED = /permission denied|row-level security|append-only/i;

/** Runs a statement bound to an actor; always rolls back. `denied` when the role may not do it. */
async function run(actor: RlsActor | null, q: string): Promise<{ rows: number; denied: boolean }> {
  let rows = 0;
  let denied = false;
  await h.db
    .transaction(async (tx) => {
      if (actor) await bindActor(tx, actor);
      const r = await tx.execute(sql.raw(q));
      rows = q.trimStart().toUpperCase().startsWith('SELECT COUNT')
        ? Number((r as unknown as { n: number }[])[0]!.n)
        : (r as unknown as unknown[]).length;
      throw new Rollback();
    })
    .catch((e: unknown) => {
      if (e instanceof Rollback) return;
      const msg = String(
        (e as { cause?: { message?: string } }).cause?.message ?? (e as Error).message,
      );
      if (DENIED.test(msg)) denied = true;
      else throw e;
    });
  return { rows, denied };
}

/** SQL expression with the organization that owns a row of `t` (alias t), or null. */
function orgOf(table: string): string | null {
  const c = columns.get(table)!;
  if (table === 'organizations') return 't.id';
  if (c.has('organization_id')) return 't.organization_id';
  const p = RLS_POLICIES[table]!;
  if (p.kind === 'catalog_child')
    return `(SELECT x.organization_id FROM ${p.parent} x WHERE x.id = t.${p.fk})`;
  if (c.has('client_id'))
    return '(SELECT x.organization_id FROM clients x WHERE x.id = t.client_id)';
  if (c.has('recommendation_id'))
    return '(SELECT x.organization_id FROM recommendations x WHERE x.id = t.recommendation_id)';
  if (c.has('user_id')) return '(SELECT x.organization_id FROM users x WHERE x.id = t.user_id)';
  return null;
}

/** SQL expression with the client a row belongs to, or null for tables that are not per client. */
function clientOf(table: string): string | null {
  const c = columns.get(table)!;
  if (table === 'clients') return 't.id';
  if (c.has('client_id')) return 't.client_id';
  if (c.has('recommendation_id'))
    return '(SELECT x.client_id FROM recommendations x WHERE x.id = t.recommendation_id)';
  return null;
}

const firstColumn = (table: string) => (table === 'organizations' ? 'name' : firstCol.get(table)!);
const count = (table: string, where: string) =>
  `SELECT count(*)::int AS n FROM ${table} t WHERE ${where}`;
const touch = (table: string, where: string) =>
  `UPDATE ${table} t SET ${firstColumn(table)} = t.${firstColumn(table)} WHERE ${where} RETURNING 1`;
const remove = (table: string, where: string) =>
  `DELETE FROM ${table} t WHERE ${where} RETURNING 1`;

/** What the specification grants the client on their own rows (§14.2), per table. */
function clientMay(table: string): { read: boolean; write: boolean } {
  const p = RLS_POLICIES[table]!;
  if (p.kind === 'client_child') return { read: true, write: p.clientWrite };
  if (p.kind === 'client_owned' || p.kind === 'client_optional')
    return { read: p.clientRead, write: p.clientWrite };
  const custom: Record<string, { read: boolean; write: boolean }> = {
    // Own contact details (PATCH /clients/{id}); other columns are blocked by a trigger (below).
    clients: { read: true, write: true },
    trainer_client_assignments: { read: true, write: false },
    audit_logs: { read: false, write: false },
    recommendation_evidence: { read: false, write: false },
  };
  return custom[table] ?? { read: false, write: false };
}

const tables = Object.entries(RLS_POLICIES)
  .filter(([, p]) => p.kind !== 'global_readonly')
  .map(([t]) => t);

/** Which checks had data to bite on, per table (for the coverage assertion). */
const exercised = new Map<string, Set<string>>();
const mark = (table: string, check: string) =>
  (exercised.get(table) ?? exercised.set(table, new Set()).get(table)!).add(check);

beforeAll(async () => {
  if (!URL) throw new Error('DATABASE_URL (demo database) is required');
  h = createDb(URL, { max: 4 });
  const cols = (await h.db.execute(
    sql`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`,
  )) as unknown as { table_name: string; column_name: string }[];
  for (const r of cols) if (!firstCol.has(r.table_name)) firstCol.set(r.table_name, r.column_name);
  for (const r of cols)
    (columns.get(r.table_name) ?? columns.set(r.table_name, new Set()).get(r.table_name)!).add(
      r.column_name,
    );

  const actor = async (email: string): Promise<RlsActor> => {
    const [u] = (await h.db.execute(sql`
      SELECT u.id, u.organization_id,
        (SELECT array_agg(r.key) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles,
        (SELECT t.id FROM trainers t WHERE t.user_id = u.id) AS trainer_id,
        (SELECT c.id FROM clients c WHERE c.user_id = u.id) AS client_id
      FROM users u WHERE u.email = ${email}`)) as unknown as {
      id: string;
      organization_id: string;
      roles: string[];
      trainer_id: string | null;
      client_id: string | null;
    }[];
    if (!u) throw new Error(`Demo user ${email} not found: run pnpm db:seed:demo`);
    return {
      userId: u.id,
      organizationId: u.organization_id,
      roles: u.roles,
      trainerId: u.trainer_id,
      clientId: u.client_id,
    };
  };
  A = {
    adminA: await actor('lucia.moreno@example.com'),
    trainerAssigned: await actor('nerea.soto@example.com'),
    trainerOther: await actor('pablo.ibarra@example.com'),
    victim: await actor('elena.prieto@example.com'),
    otherClient: await actor('marcos.villalba@example.com'),
    adminB: await actor('ane.urrutia@example.com'),
  };
  orgA = A.adminA.organizationId;
  victimClient = A.victim.clientId!;
  expect(A.adminB.organizationId).not.toBe(orgA);
}, 60_000);

afterAll(async () => {
  await h?.close();
});

describe.each(tables)('RLS %s', (table) => {
  const kind = () => RLS_POLICIES[table]!.kind;

  it('system-only tables: closed to every runtime actor', async () => {
    if (kind() !== 'system_only') return;
    for (const a of Object.values(A)) {
      const r = await run(a, `SELECT count(*)::int AS n FROM ${table}`);
      expect(r.denied || r.rows === 0, `${table} readable by the runtime role`).toBe(true);
    }
    mark(table, 'negative');
  });

  it('positive: ADMIN reads every row of the organization; the assigned trainer, every row of the client', async () => {
    if (kind() === 'system_only') return;
    const org = orgOf(table);
    if (!org) return;
    const own =
      table === 'notifications' || table === 'user_recovery_codes'
        ? `t.user_id = '${A.adminA.userId}'`
        : `${org} = '${orgA}'`;
    const total = (await run(null, count(table, own))).rows;
    const seen = await run(A.adminA, count(table, own));
    expect(seen.denied).toBe(false);
    expect(seen.rows, `${table}: ADMIN sees ${seen.rows} of ${total}`).toBe(total);
    if (total > 0) mark(table, 'positive-admin');

    const client = clientOf(table);
    if (client && table !== 'notifications') {
      const where = `${client} = '${victimClient}'`;
      const n = (await run(null, count(table, where))).rows;
      expect((await run(A.trainerAssigned, count(table, where))).rows).toBe(n);
      if (n > 0) mark(table, 'positive-trainer');
    }
  });

  it('positive: ADMIN can update the rows of the organization (append-only audit excepted)', async () => {
    if (kind() === 'system_only' || ['notifications', 'user_recovery_codes'].includes(table))
      return;
    const org = orgOf(table);
    if (!org) return;
    const where = `${org} = '${orgA}'`;
    const total = (await run(null, count(table, where))).rows;
    const r = await run(A.adminA, touch(table, where));
    if (table === 'audit_logs') {
      expect(r.denied, 'audit_logs must be append-only').toBe(true);
      mark(table, 'negative-write');
      return;
    }
    expect(r.denied).toBe(false);
    expect(r.rows, `${table}: ADMIN updated ${r.rows} of ${total}`).toBe(total);
    if (total > 0) mark(table, 'positive-write');
  });

  it('positive/negative: the client reads and writes their own rows only as the specification allows', async () => {
    const client = clientOf(table);
    if (kind() === 'system_only' || !client) return;
    const where = `${client} = '${victimClient}'`;
    const total = (await run(null, count(table, where))).rows;
    if (total === 0) return;
    const may = clientMay(table);
    const read = await run(A.victim, count(table, where));
    expect(read.rows, `${table}: client read ${read.rows} of ${total}`).toBe(may.read ? total : 0);
    const write = await run(A.victim, touch(table, where));
    if (may.write) {
      expect(write.rows, `${table}: client could not update own rows`).toBe(total);
      mark(table, 'positive-client');
    } else {
      expect(write.denied || write.rows === 0, `${table}: client updated staff data`).toBe(true);
      const del = await run(A.victim, remove(table, where));
      expect(del.denied || del.rows === 0, `${table}: client deleted staff data`).toBe(true);
      mark(table, 'negative-client-write');
    }
    mark(table, may.read ? 'positive-client' : 'negative-client-read');
  });

  it('negative: another organization, another client and an unassigned trainer see and change nothing', async () => {
    if (kind() === 'system_only') return;
    const org = orgOf(table);
    const client = clientOf(table);
    const targets: [RlsActor, string | null][] = [
      [A.adminB, org ? `${org} = '${orgA}'` : null],
      [
        A.otherClient,
        client
          ? `${client} = '${victimClient}'`
          : org
            ? `${org} = '${orgA}' AND ${clientOf(table) ?? 'NULL'} IS NOT NULL`
            : null,
      ],
      [A.trainerOther, client ? `${client} = '${victimClient}'` : null],
    ];
    for (const [attacker, where] of targets) {
      if (!where) continue;
      const total = (await run(null, count(table, where))).rows;
      if (total === 0) continue;
      const seen = await run(attacker, count(table, where));
      expect(
        seen.rows,
        `${table}: ${attacker.roles.join('+')} of another scope sees ${seen.rows} rows`,
      ).toBe(0);
      const upd = await run(attacker, touch(table, where));
      expect(upd.denied || upd.rows === 0, `${table}: updated across scopes`).toBe(true);
      const del = await run(attacker, remove(table, where));
      expect(del.denied || del.rows === 0, `${table}: deleted across scopes`).toBe(true);
      mark(table, attacker === A.adminB ? 'negative-org' : 'negative-scope');
    }
  });

  it('negative: a client cannot change organization catalogues or staff tables', async () => {
    if (!['catalog', 'catalog_child'].includes(kind())) return;
    const org = orgOf(table)!;
    const where = `${org} = '${orgA}'`;
    const total = (await run(null, count(table, where))).rows;
    if (total === 0) return;
    const r = await run(A.victim, touch(table, where));
    expect(r.denied || r.rows === 0, `${table}: client changed the catalogue`).toBe(true);
    mark(table, 'negative-client-write');
  });
});

describe('clients: a client changes only their contact details', () => {
  it('email, phone and preferences yes; name, status or the user link no', async () => {
    const own = `id = '${victimClient}'`;
    expect(
      (await run(A.victim, `UPDATE clients SET preferences = 'x' WHERE ${own} RETURNING 1`)).rows,
    ).toBe(1);
    for (const set of [
      "first_name = 'X'",
      "status = 'archived'",
      'user_id = NULL',
      'auto_apply_load_progressions = true',
    ])
      expect(
        (await run(A.victim, `UPDATE clients SET ${set} WHERE ${own} RETURNING 1`)).denied,
        set,
      ).toBe(true);
    // Staff are not restricted by the trigger.
    expect(
      (await run(A.trainerAssigned, `UPDATE clients SET first_name = 'X' WHERE ${own} RETURNING 1`))
        .rows,
    ).toBe(1);
  });
});

/**
 * Tables without demo rows for a check. Their policy is the same generated one as other tables of
 * their kind (tested above); custom ones have a dedicated integration test.
 */
const NO_DEMO_DATA: Record<string, string> = {
  user_recovery_codes: 'privacy.int.test.ts (recovery codes)',
  import_jobs: 'reports.int.test.ts (imports)',
  import_rows: 'reports.int.test.ts (imports)',
  domain_events: 'insert-only by the system; no reads',
};

describe('RLS matrix coverage', () => {
  it('every policy kind, and every custom policy, was exercised with data, positive and negative', () => {
    const byKind = new Map<string, Set<string>>();
    for (const t of tables) {
      const k = RLS_POLICIES[t]!.kind;
      const key = k === 'custom' ? `custom:${t}` : k;
      const s = byKind.get(key) ?? byKind.set(key, new Set()).get(key)!;
      for (const c of exercised.get(t) ?? []) s.add(c);
    }
    const missing: string[] = [];
    for (const [key, checks] of byKind) {
      if (key.startsWith('custom:') && NO_DEMO_DATA[key.slice(7)]) continue;
      const positive = [...checks].some((c) => c.startsWith('positive'));
      const negative = [...checks].some((c) => c.startsWith('negative'));
      if (!positive && key !== 'system_only') missing.push(`${key}: sin test positivo con datos`);
      if (!negative) missing.push(`${key}: sin test negativo con datos`);
    }
    expect(missing).toEqual([]);
  });
});
