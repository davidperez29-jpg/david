import 'dotenv/config';
import { runMigrations } from '../src/migrate';

await runMigrations(process.env.DATABASE_URL!);
console.log('Migrations applied.');
