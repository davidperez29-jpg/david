/**
 * Copias de seguridad de la base local de TrainPro (datos ficticios; docs/V1_SPEC.md §8.3.6).
 *
 *   pnpm db:status                 Dónde está la base, qué contiene y qué copias hay.
 *   pnpm db:backup                 Copia en línea verificada (puede hacerse con el servidor en marcha).
 *   pnpm db:restore <copia>        Sustituye la base por una copia verificada. EL SERVIDOR DEBE
 *                                  ESTAR PARADO. Antes guarda una copia del estado actual.
 *
 * La carpeta de datos es `TRAINPRO_DATA_DIR` (por defecto `.data`), también desde `.env.local`.
 * Node 26 ejecuta este archivo directamente (TypeScript sin compilar).
 */
import { existsSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import {
  BackupError,
  createBackup,
  listBackups,
  resolveBackup,
  restoreBackup,
} from '../src/server/db/backup.ts';
import { databaseFile, resolveDataDir } from '../src/server/db/location.ts';
import { processUsing } from '../src/server/db/lock.ts';
import { MIGRATIONS } from '../src/server/db/migrate.ts';
import { openSqlite } from '../src/server/db/sqlite.ts';

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const databasePath = databaseFile(resolveDataDir(process.env.TRAINPRO_DATA_DIR));
const [command, argument] = process.argv.slice(2);

const fail = (message: string): never => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const requireDatabase = () => {
  if (!existsSync(databasePath)) {
    fail(
      `Aún no hay base de datos en ${databasePath}. Arranca la aplicación una vez para crearla.`,
    );
  }
};

const size = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;

async function main() {
  switch (command) {
    case 'status': {
      console.log(`Base de datos: ${databasePath}`);
      if (!existsSync(databasePath)) {
        console.log('  (todavía no existe: se crea al arrancar la aplicación)');
      } else {
        const db = openSqlite(databasePath, { readonly: true });
        try {
          const meta = Object.fromEntries(
            db
              .prepare('SELECT key, value FROM meta')
              .all<{ key: string; value: string }>()
              .map((row) => [row.key, row.value]),
          );
          const versions = db
            .prepare('SELECT version FROM schema_migrations ORDER BY version')
            .all<{ version: number }>()
            .map((row) => row.version);
          const count = (table: string) =>
            db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get<{ n: number }>()!.n;
          const wal = existsSync(`${databasePath}-wal`) ? statSync(`${databasePath}-wal`).size : 0;
          console.log(`  Tamaño: ${size(statSync(databasePath).size + wal)} (incluido el WAL)`);
          console.log(
            `  Migraciones: ${versions.join(', ') || 'ninguna'} (el código tiene ${MIGRATIONS.length})`,
          );
          console.log(`  Semilla: ${meta.seed_date ?? '—'} (versión ${meta.seed_version ?? '—'})`);
          console.log(
            `  Sesiones: ${count('session')} · versiones: ${count('session_version')} · registros: ${count('session_log')} · series: ${count('set_log')}`,
          );
          console.log(`  Integridad: ${db.integrityCheck()}`);
        } finally {
          db.close();
        }
        const pid = processUsing(databasePath);
        console.log(
          pid ? `  En uso por el servidor (proceso ${pid}).` : '  Sin servidor usándola.',
        );
      }
      const backups = listBackups(databasePath);
      console.log(`Copias (${backups.length}):`);
      for (const backup of backups) console.log(`  ${backup.name}  ${size(backup.sizeBytes)}`);
      return;
    }

    case 'backup': {
      requireDatabase();
      const db = openSqlite(databasePath, { readonly: true });
      try {
        const backup = await createBackup(db, { label: 'manual' });
        console.log(`✓ Copia verificada (integridad, relaciones y migraciones): ${backup.file}`);
      } finally {
        db.close();
      }
      return;
    }

    case 'restore': {
      if (!argument) fail('Indica la copia: pnpm db:restore <nombre o ruta del archivo>.');
      const pid = processUsing(databasePath);
      if (pid) {
        fail(
          `El servidor (proceso ${pid}) tiene la base abierta. Páralo antes de restaurar una copia.`,
        );
      }
      const file =
        isAbsolute(argument!) || argument!.includes('/') || argument!.includes('\\')
          ? resolve(argument!)
          : resolveBackup(databasePath, argument!);
      restoreBackup(databasePath, file);
      console.log(`✓ Base restaurada desde ${file} y verificada.`);
      console.log('  El estado anterior quedó guardado en backups/ como «antes-de-restaurar».');
      return;
    }

    default:
      console.log('Uso: pnpm db:status | pnpm db:backup | pnpm db:restore <copia>');
      process.exit(command ? 1 : 0);
  }
}

main().catch((error: unknown) => {
  fail(error instanceof BackupError ? error.message : String((error as Error).stack ?? error));
});
