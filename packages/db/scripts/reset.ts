import 'dotenv/config';
import { createDb } from '../src/client';
import { dropAll, runMigrations } from '../src/migrate';
import { seedCatalog } from '../src/seed/catalog';

const url = process.env.DATABASE_URL!;
await dropAll(url);
await runMigrations(url);
const { db, close } = createDb(url);
await seedCatalog(db);
await close();
console.log('Database reset: schema dropped, migrated and catalogue seeded.');
