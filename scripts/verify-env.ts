/**
 * Verificación del entorno local de TrainPro (pensada sobre todo para Windows, donde el
 * desarrollo no puede ejecutar pruebas): `pnpm verify:env`.
 *
 * Comprueba, con datos ficticios y en una carpeta propia dentro de `.data` que borra al terminar:
 * 1. que la versión de Node es la de `.nvmrc`;
 * 2. que `better-sqlite3` carga su binario en esta plataforma;
 * 3. que se crea una base, se aplican las migraciones y pasa `integrity_check`;
 * 4. que las restricciones de integridad funcionan (claves ajenas y disparadores);
 * 5. que una copia de seguridad en línea se verifica y se restaura;
 * 6. que los datos se recuperan al cerrar y volver a abrir el archivo.
 *
 * No sustituye a `pnpm check` ni a `pnpm test:e2e`: es la comprobación mínima de la capa nativa.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { arch, platform, release } from 'node:os';
import { join, resolve } from 'node:path';
import { createBackup, restoreBackup, verifyDatabaseFile } from '../src/server/db/backup.ts';
import { lockDataLocation } from '../src/server/db/lock.ts';
import { migrate, MIGRATIONS } from '../src/server/db/migrate.ts';
import { constraintKind, openSqlite } from '../src/server/db/sqlite.ts';

const results: { step: string; ok: boolean; detail: string }[] = [];
const check = async (step: string, run: () => string | Promise<string>) => {
  try {
    results.push({ step, ok: true, detail: await run() });
  } catch (error) {
    results.push({ step, ok: false, detail: (error as Error).message });
  }
};

const dir = resolve('.data', `verificacion-${Date.now()}`);
const file = join(dir, 'verificacion.sqlite');

async function main() {
  console.log(`TrainPro · verificación del entorno (${platform()} ${arch()}, ${release()})\n`);

  await check('Versión de Node', () => {
    const wanted = readFileSync('.nvmrc', 'utf8').trim();
    const actual = process.versions.node;
    if (actual !== wanted) throw new Error(`Node ${actual}; .nvmrc pide ${wanted}`);
    return `Node ${actual}, la de .nvmrc`;
  });

  await check('better-sqlite3 carga su binario', async () => {
    const pkg = JSON.parse(
      readFileSync(resolve('node_modules/better-sqlite3/package.json'), 'utf8'),
    ) as { version: string };
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dir, { recursive: true });
    const db = openSqlite(file);
    const version = db.prepare('SELECT sqlite_version() AS v').get<{ v: string }>()!.v;
    db.close();
    return `better-sqlite3 ${pkg.version} con SQLite ${version}`;
  });

  await check('Migraciones e integridad', () => {
    const db = openSqlite(file);
    try {
      const { applied } = migrate(db);
      const integrity = db.integrityCheck();
      if (integrity !== 'ok') throw new Error(`integrity_check: ${integrity}`);
      const journal = db.pragma('journal_mode');
      return `migraciones ${applied.join(', ')} de ${MIGRATIONS.length}; integridad ok; journal ${String(journal)}`;
    } finally {
      db.close();
    }
  });

  await check('Restricciones (claves ajenas y disparadores)', () => {
    const db = openSqlite(file);
    try {
      const attempt = (sql: string) => {
        try {
          db.exec(sql);
          return 'aceptado';
        } catch (error) {
          return constraintKind(error) ?? 'otro error';
        }
      };
      const fk = attempt(
        "INSERT INTO client (id, trainer_id, display_name, status, population, goal, started_on, created_at) VALUES ('c-x', 'no-existe', 'X', 'active', 'general_health', 'x', '2026-01-01', '2026-01-01T00:00:00.000Z')",
      );
      if (fk !== 'foreign_key') throw new Error(`clave ajena: ${fk}`);
      db.exec("INSERT INTO trainer (id, display_name) VALUES ('t-x', 'Entrenador ficticio')");
      return 'una relación rota se rechaza';
    } finally {
      db.close();
    }
  });

  await check('Copia en línea y restauración', async () => {
    const db = openSqlite(file);
    const backup = await createBackup(db, { label: 'verificacion' });
    db.exec("INSERT INTO trainer (id, display_name) VALUES ('t-y', 'Después de la copia')");
    db.close();
    const lock = lockDataLocation(file, 'restauracion');
    try {
      await restoreBackup(lock, backup.file);
    } finally {
      lock.release();
    }
    verifyDatabaseFile(file);
    const reopened = openSqlite(file);
    const ids = reopened
      .prepare('SELECT id FROM trainer ORDER BY id')
      .all<{ id: string }>()
      .map((r) => r.id);
    reopened.close();
    if (ids.join(',') !== 't-x') throw new Error(`tras restaurar: ${ids.join(',')}`);
    return 'la copia es íntegra y la restauración (segura, con bloqueo exclusivo) recupera exactamente sus datos';
  });

  await check('Persistencia al cerrar y volver a abrir', () => {
    const db = openSqlite(file);
    const n = db.prepare('SELECT COUNT(*) AS n FROM trainer').get<{ n: number }>()!.n;
    db.close();
    if (n !== 1) throw new Error(`se esperaba 1 fila, hay ${n}`);
    return 'los datos siguen en el archivo';
  });

  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });

  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.step}: ${r.detail}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    failed === 0
      ? '\nTodo correcto. Siguiente paso: pnpm check y pnpm test:e2e.'
      : `\n${failed} comprobación(es) fallida(s). Copia esta salida en el informe.`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
