/**
 * Daily monitoring job (§13.7): re-evaluates the alerts of every client with an active plan, so
 * time-based rules (missed sessions, overdue reassessment, adherence windows) fire without any
 * new event. Usage: pnpm monitor:daily   (schedule once a day, e.g. cron `15 5 * * *`).
 */
import 'dotenv/config';
import { createDb } from '@tp/db';
import { monitorAllClients } from '../src';

const { db, close } = createDb(process.env.DATABASE_URL!);
const r = await monitorAllClients({ db, now: () => new Date() });
await close();
console.log(
  `Monitoring: ${r.clients} clients evaluated, ${r.created} alerts created, ${r.resolved} resolved.`,
);
