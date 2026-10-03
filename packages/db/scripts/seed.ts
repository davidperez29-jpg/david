import 'dotenv/config';
import { createDb } from '../src/client';
import { seedCatalog } from '../src/seed/catalog';

const { db, close } = createDb(process.env.DATABASE_URL!);
await seedCatalog(db);
await close();
console.log('Catalogue seeded (roles, permissions, goals, sports, equipment).');
