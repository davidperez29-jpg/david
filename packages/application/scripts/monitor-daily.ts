/**
 * Daily monitoring job (§13.7): re-evaluates the alerts of every client with an active plan, so
 * time-based rules (missed sessions, overdue reassessment, adherence windows) fire without any
 * new event, and then the programming engine's adjustment proposals (§12.2; they never change a
 * plan on their own). Usage: pnpm monitor:daily   (schedule once a day, e.g. cron `15 5 * * *`).
 */
import 'dotenv/config';
import { createDb } from '@tp/db';
import { evaluateAllAdjustments, monitorAllClients } from '../src';

const { db, close } = createDb(process.env.DATABASE_URL!);
const app = { db, now: () => new Date() };
const r = await monitorAllClients(app);
const a = await evaluateAllAdjustments(app);
await close();
console.log(
  `Monitoring: ${r.clients} clients evaluated, ${r.created} alerts created, ${r.resolved} resolved.`,
);
console.log(`Programming: ${a.clients} active plans, ${a.created} adjustment proposals created.`);
