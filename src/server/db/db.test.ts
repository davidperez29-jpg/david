import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBackup, listBackups, restoreBackup, verifyDatabaseFile } from './backup.ts';
import { lockDataLocation } from './lock.ts';
import { checksum, migrate, MigrationError, MIGRATIONS } from './migrate.ts';
import { constraintKind, openSqlite, type SqlDatabase } from './sqlite.ts';

/**
 * Pruebas de la base real (archivos SQLite en una carpeta temporal): restricciones, migraciones,
 * copias y restauración. Nada de esto se simula en memoria.
 * B1-06 (integridad), B1-08 (duplicados en ejecución) y B1-10 (migraciones y copias).
 */

let dir: string;
let db: SqlDatabase;
const NOW = '2026-11-09T10:00:00.000Z';

function seedMinimal(target: SqlDatabase) {
  target.exec(`
    INSERT INTO trainer VALUES ('t-1', 'Entrenadora ficticia');
    INSERT INTO client VALUES ('c-1', 't-1', 'Cliente ficticio', 'active', 'general_health', 'Objetivo', NULL, '2026-01-01', '2026-01-01T09:00:00.000Z');
  `);
  target.transaction(() => {
    target
      .prepare(
        `INSERT INTO session (id, client_id, trainer_id, planned_date, day_order, status, current_version, created_at, updated_at)
         VALUES ('s-1', 'c-1', 't-1', '2026-11-09', 1, 'published', 1, @now, @now)`,
      )
      .run({ now: NOW });
    target
      .prepare(
        `INSERT INTO session_version (id, session_id, number, content, published_at, published_by, execution_state)
         VALUES ('v-1', 's-1', 1, '{"schema":1}', @now, 't-1', 'not_started')`,
      )
      .run({ now: NOW });
  });
  target
    .prepare(
      `INSERT INTO session_log (id, session_id, client_id, started_version, started_at, start_device_at, start_time_zone, start_utc_offset_min, start_received_at, last_activity_at)
       VALUES ('l-1', 's-1', 'c-1', 1, @now, @now, 'Europe/Madrid', 60, @now, @now)`,
    )
    .run({ now: NOW });
}

function insertSet(
  target: SqlDatabase,
  id: string,
  extra: Partial<Record<string, string | number | null>> = {},
) {
  const row = {
    id,
    log: 'l-1',
    session: 's-1',
    client: 'c-1',
    version: 1,
    rx: 'itm-1',
    setNumber: 1,
    completed: 1,
    reps: 10,
    loadKind: 'external',
    loadKg: 60,
    supersedes: null,
    now: NOW,
    ...extra,
  };
  target
    .prepare(
      `INSERT INTO set_log (client_set_id, session_log_id, session_id, client_id, version_number, prescription_id, variant_id, set_number,
         completed, reps, load_kind, load_kg, supersedes, performed_at, device_recorded_at, device_time_zone, device_utc_offset_min, received_at)
       VALUES (@id, @log, @session, @client, @version, @rx, 'ex-back-squat', @setNumber,
         @completed, @reps, @loadKind, @loadKg, @supersedes, @now, @now, 'Europe/Madrid', 60, @now)`,
    )
    .run(row);
}

const kindOf = (fn: () => unknown) => {
  try {
    fn();
    return 'accepted';
  } catch (error) {
    return constraintKind(error) ?? (error as Error).message;
  }
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainpro-db-'));
  db = openSqlite(join(dir, 'trainpro.sqlite'));
  migrate(db, { now: () => NOW });
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('configuración de la conexión', () => {
  it('usa WAL, synchronous=FULL y claves ajenas', () => {
    expect(db.pragma('journal_mode')).toBe('wal');
    expect(db.pragma('synchronous')).toBe(2); // FULL
    expect(db.pragma('foreign_keys')).toBe(1);
  });
});

describe('B1-06 · integridad de las relaciones', () => {
  beforeEach(() => seedMinimal(db));

  it('rechaza una sesión de un cliente inexistente o de otro entrenador', () => {
    const insert = (client: string, trainer: string) =>
      db
        .prepare(
          `INSERT INTO session (id, client_id, trainer_id, planned_date, day_order, status, draft_content, created_at, updated_at)
           VALUES ('s-x', @client, @trainer, '2026-11-09', 1, 'draft', '{}', @now, @now)`,
        )
        .run({ client, trainer, now: NOW });
    expect(kindOf(() => insert('c-nadie', 't-1'))).toBe('foreign_key');
    db.exec("INSERT INTO trainer VALUES ('t-2', 'Otro entrenador ficticio')");
    expect(kindOf(() => insert('c-1', 't-2'))).toBe('foreign_key');
  });

  it('rechaza una sesión publicada sin su versión y una serie de una versión inexistente', () => {
    expect(
      kindOf(() =>
        db
          .prepare(
            `INSERT INTO session (id, client_id, trainer_id, planned_date, day_order, status, current_version, created_at, updated_at)
             VALUES ('s-2', 'c-1', 't-1', '2026-11-09', 2, 'published', 1, @now, @now)`,
          )
          .run({ now: NOW }),
      ),
    ).toBe('foreign_key');
    expect(kindOf(() => insertSet(db, 'set-a', { version: 7 }))).toBe('foreign_key');
  });

  it('admite varias sesiones del mismo cliente el mismo día', () => {
    const insert = (id: string, order: number) =>
      db
        .prepare(
          `INSERT INTO session (id, client_id, trainer_id, planned_date, day_order, label, status, draft_content, created_at, updated_at)
           VALUES (@id, 'c-1', 't-1', '2026-11-09', @order, 'Tarde', 'draft', '{}', @now, @now)`,
        )
        .run({ id, order, now: NOW });
    insert('s-2', 2);
    insert('s-3', 3);
    const count = db
      .prepare(
        "SELECT count(*) AS n FROM session WHERE client_id = 'c-1' AND planned_date = '2026-11-09'",
      )
      .get<{ n: number }>();
    expect(count?.n).toBe(3);
  });

  it('aplica los CHECK de rangos y de coherencia', () => {
    expect(kindOf(() => insertSet(db, 'set-b', { reps: 0 }))).toBe('check');
    expect(kindOf(() => insertSet(db, 'set-c', { loadKg: 900 }))).toBe('check');
    // Serie no hecha con repeticiones: incoherente.
    expect(kindOf(() => insertSet(db, 'set-d', { completed: 0 }))).toBe('check');
    expect(
      kindOf(() =>
        insertSet(db, 'set-e', { completed: 0, reps: null, loadKind: null, loadKg: null }),
      ),
    ).toBe('accepted');
  });

  it('las versiones publicadas no se modifican ni se borran', () => {
    expect(kindOf(() => db.exec("UPDATE session_version SET content = '{}'"))).toBe('trigger');
    expect(kindOf(() => db.exec('DELETE FROM session_version'))).toBe('trigger');
  });
});

describe('B1-08 · duplicados en las tablas de ejecución', () => {
  beforeEach(() => seedMinimal(db));

  it('un client_set_id repetido se rechaza', () => {
    insertSet(db, 'set-1');
    expect(kindOf(() => insertSet(db, 'set-1', { setNumber: 2 }))).toBe('primary_key');
  });

  it('un segundo registro original de la misma serie se rechaza', () => {
    insertSet(db, 'set-1');
    expect(kindOf(() => insertSet(db, 'set-2'))).toBe('unique');
  });

  it('una corrección sustituye una sola vez y solo a la misma serie', () => {
    insertSet(db, 'set-1');
    expect(kindOf(() => insertSet(db, 'set-2', { supersedes: 'set-1', reps: 8 }))).toBe('accepted');
    expect(kindOf(() => insertSet(db, 'set-3', { supersedes: 'set-1', reps: 7 }))).toBe('unique');
    insertSet(db, 'set-4', { setNumber: 2 });
    expect(kindOf(() => insertSet(db, 'set-5', { supersedes: 'set-4', setNumber: 3 }))).toBe(
      'trigger',
    );
  });

  it('los registros de series y los comandos no se modifican ni se borran', () => {
    insertSet(db, 'set-1');
    expect(kindOf(() => db.exec('UPDATE set_log SET reps = 9'))).toBe('trigger');
    expect(kindOf(() => db.exec('DELETE FROM set_log'))).toBe('trigger');
    db.prepare(
      `INSERT INTO client_command VALUES ('cmd-00001', 's-1', 'c-1', 'start', @hash, @now)`,
    ).run({ hash: 'a'.repeat(64), now: NOW });
    expect(kindOf(() => db.exec('DELETE FROM client_command'))).toBe('trigger');
  });

  it('una transacción que falla no deja nada a medias', () => {
    expect(() =>
      db.transaction(() => {
        insertSet(db, 'set-1');
        insertSet(db, 'set-1'); // duplicado: aborta toda la transacción
      }),
    ).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM set_log').get<{ n: number }>()?.n).toBe(0);
  });

  it('el inicio de una ejecución no cambia y el fin se registra una sola vez', () => {
    expect(
      kindOf(() => db.exec("UPDATE session_log SET started_at = '2026-11-09T11:00:00.000Z'")),
    ).toBe('trigger');
    const finish = () =>
      db
        .prepare(
          `UPDATE session_log SET finished_at = @now, finish_device_at = @now, finish_received_at = @now,
             finish_reason = 'all_done', pending_sets_confirmed = 0`,
        )
        .run({ now: NOW });
    expect(kindOf(finish)).toBe('accepted');
    expect(kindOf(finish)).toBe('trigger');
  });
});

describe('B1-10 · migraciones', () => {
  it('una base vacía aplica todas las migraciones en orden y no las vuelve a aplicar', () => {
    const file = join(dir, 'nueva.sqlite');
    const fresh = openSqlite(file);
    expect(migrate(fresh).applied).toEqual([1, 2]);
    expect(migrate(fresh).applied).toEqual([]);
    const rows = fresh
      .prepare('SELECT version, checksum FROM schema_migrations ORDER BY version')
      .all<{ version: number; checksum: string }>();
    expect(rows).toEqual(
      MIGRATIONS.map((m) => ({ version: m.version, checksum: checksum(m.sql) })),
    );
    // Tras reconstruir tablas, las claves ajenas siguen activas.
    expect(fresh.pragma('foreign_keys')).toBe(1);
    fresh.close();
  });

  it('el arranque falla si una migración aplicada ha cambiado', () => {
    const altered = [{ ...MIGRATIONS[0]!, sql: `${MIGRATIONS[0]!.sql}\n-- cambio` }];
    expect(() => migrate(db, { migrations: altered })).toThrow(MigrationError);
  });

  it('el arranque falla si la base tiene una migración que el código no conoce', () => {
    db.prepare("INSERT INTO schema_migrations VALUES (99, 'futura', 'x', @now)").run({ now: NOW });
    expect(() => migrate(db)).toThrow(/no conoce/);
  });

  it('avisa antes de migrar una base existente (para hacer la copia previa)', () => {
    const next = [
      ...MIGRATIONS,
      {
        version: MIGRATIONS.length + 1,
        name: 'prueba',
        sql: 'CREATE TABLE prueba (x INTEGER) STRICT;',
      },
    ];
    const calls: number[] = [];
    expect(
      migrate(db, {
        migrations: next,
        beforeMigrate: (p) => calls.push(...p.map((m) => m.version)),
      }).applied,
    ).toEqual([MIGRATIONS.length + 1]);
    expect(calls).toEqual([MIGRATIONS.length + 1]);
  });
});

describe('B1-10 · copias de seguridad y restauración', () => {
  beforeEach(() => seedMinimal(db));

  it('la copia en línea es íntegra y la restauración recupera exactamente los datos', async () => {
    const backup = await createBackup(db, { label: 'prueba' });
    expect(listBackups(db.path).map((b) => b.name)).toContain(backup.name);

    // Cambios posteriores a la copia…
    db.exec("INSERT INTO trainer VALUES ('t-9', 'Posterior a la copia')");
    db.close();

    // …que desaparecen al restaurar, y queda una copia del estado anterior.
    const lock = lockDataLocation(join(dir, 'trainpro.sqlite'), 'pruebas');
    await restoreBackup(lock, backup.file);
    lock.release();
    db = openSqlite(join(dir, 'trainpro.sqlite'));
    expect(db.integrityCheck()).toBe('ok');
    expect(
      db.prepare("SELECT count(*) AS n FROM trainer WHERE id = 't-9'").get<{ n: number }>()?.n,
    ).toBe(0);
    expect(
      db.prepare("SELECT count(*) AS n FROM session WHERE id = 's-1'").get<{ n: number }>()?.n,
    ).toBe(1);
    expect(listBackups(db.path).some((b) => b.name.includes('antes-de-restaurar'))).toBe(true);
  });

  it('rechaza restaurar un archivo dañado o que no es de TrainPro', () => {
    const bogus = join(dir, 'backups', 'falsa.sqlite');
    writeFileSync(join(dir, 'no-sqlite.sqlite'), 'esto no es una base de datos');
    expect(() => verifyDatabaseFile(join(dir, 'no-sqlite.sqlite'))).toThrow();
    expect(() => verifyDatabaseFile(bogus)).toThrow(/No existe/);
    const other = openSqlite(join(dir, 'ajena.sqlite'));
    other.exec('CREATE TABLE cosa (x INTEGER)');
    other.close();
    expect(() => verifyDatabaseFile(join(dir, 'ajena.sqlite'))).toThrow(
      /no es una base de TrainPro/,
    );
  });
});
