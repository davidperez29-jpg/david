/**
 * Copias de seguridad de la base local de TrainPro (datos ficticios; docs/V1_SPEC.md §8.3.6).
 *
 *   pnpm db:status                 Dónde está la base, quién la usa, qué contiene y qué copias hay.
 *   pnpm db:backup                 Copia en línea verificada (puede hacerse con el servidor en marcha:
 *                                  es una lectura coherente y no necesita la base en exclusiva).
 *   pnpm db:restore <copia>        Restauración segura (ADR-25): exige la base en exclusiva (el
 *                                  servidor parado), guarda antes el estado actual y sustituye la
 *                                  base de forma atómica. Si se interrumpe, se puede terminar o
 *                                  anular con `pnpm db:recover` (el servidor también lo hace al arrancar).
 *   pnpm db:recover                Termina o anula una restauración interrumpida.
 *
 * Solo para las pruebas: `TRAINPRO_TEST_PAUSE_AT=<fase>` detiene la restauración en esa fase
 * (escribe «PAUSA <fase>» y espera) para poder interrumpirla en un punto exacto.
 *
 * La carpeta de datos es `TRAINPRO_DATA_DIR` (por defecto `.data`), también desde `.env.local`.
 * Node 26 ejecuta este archivo directamente (TypeScript sin compilar).
 */
import { existsSync, statSync, writeSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import {
  BackupError,
  createBackup,
  hasInterruptedRestore,
  listBackups,
  recoverInterruptedRestore,
  RESTORE_PHASES,
  type RestoreHooks,
  type RestorePhase,
  resolveBackup,
  restoreBackup,
} from '../src/server/db/backup.ts';
import { databaseFile, resolveDataDir } from '../src/server/db/location.ts';
import {
  DataLocationBusyError,
  describeHolder,
  lockDataLocation,
  lockState,
} from '../src/server/db/lock.ts';
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

/** Punto de pausa de las pruebas (solo con TRAINPRO_TEST_PAUSE_AT). */
const pauseAt = process.env.TRAINPRO_TEST_PAUSE_AT as RestorePhase | undefined;
if (pauseAt && !RESTORE_PHASES.includes(pauseAt)) fail(`Fase de pausa desconocida: ${pauseAt}`);
const hooks: RestoreHooks = {
  pause: (phase) => {
    if (phase !== pauseAt) return;
    writeSync(1, `PAUSA ${phase}\n`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60_000);
  },
};

/** Toma la base en exclusiva o termina explicando quién la usa. */
const exclusive = (role: 'restauracion' | 'recuperacion') => {
  try {
    return lockDataLocation(databasePath, role);
  } catch (error) {
    if (error instanceof DataLocationBusyError) fail(error.message);
    throw error;
  }
};

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
        const { held, holder } = lockState(databasePath);
        console.log(held ? `  En uso por ${describeHolder(holder)}.` : '  Sin servidor usándola.');
        if (hasInterruptedRestore(databasePath)) {
          console.log(
            '  ⚠ Hay una restauración interrumpida: pnpm db:recover (o arranca el servidor).',
          );
        }
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
      const file =
        isAbsolute(argument!) || argument!.includes('/') || argument!.includes('\\')
          ? resolve(argument!)
          : resolveBackup(databasePath, argument!);
      const lock = exclusive('restauracion');
      try {
        const result = await restoreBackup(lock, file, hooks);
        if (result.recovered && result.recovered !== 'nada') {
          console.log(`  Antes se recuperó una restauración interrumpida: ${result.recovered}.`);
        }
        console.log(`✓ Base restaurada desde ${file} y verificada.`);
        if (result.previous) {
          console.log(
            result.previousVerified
              ? `  El estado anterior (también lo que había en el WAL) está en ${result.previous}.`
              : `  ⚠ La base anterior no se podía leer: se guardaron sus archivos tal cual en ${result.previous} (sin verificar).`,
          );
        }
      } finally {
        lock.release();
      }
      return;
    }

    case 'recover': {
      const lock = exclusive('recuperacion');
      try {
        const outcome = recoverInterruptedRestore(lock, hooks);
        const text = {
          nada: 'No había ninguna restauración interrumpida.',
          anulada:
            'La restauración se interrumpió antes de sustituir la base: se anuló y la base sigue como estaba.',
          completada:
            'La restauración se interrumpió después de sustituir la base: la base restaurada es válida y se da por terminada.',
          revertida:
            'La base restaurada no era válida: se ha vuelto a la copia del estado anterior.',
        }[outcome];
        console.log(`✓ ${text}`);
      } finally {
        lock.release();
      }
      return;
    }

    default:
      console.log(
        'Uso: pnpm db:status | pnpm db:backup | pnpm db:restore <copia> | pnpm db:recover',
      );
      process.exit(command ? 1 : 0);
  }
}

main().catch((error: unknown) => {
  fail(error instanceof BackupError ? error.message : String((error as Error).stack ?? error));
});
