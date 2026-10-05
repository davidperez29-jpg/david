/**
 * Daily jobs inside the app (deployment without a paid cron, docs/DEPLOY_RENDER.md): the same work
 * as `pnpm monitor:daily` and `pnpm privacy:daily`, run at most once per day and organization-wide
 * as the system (table owner, bypassing RLS like the scripts). A row in scheduled_job_runs per job
 * and day makes it safe with several instances, restarts and a host that sleeps when idle: the
 * first activity of the day runs it.
 */
import { schema, type Database } from '@tp/db';
import { localDate } from '@tp/domain';
import { and, eq } from 'drizzle-orm';
import type { FileStorage } from './storage';
import { monitorAllClients } from './monitoring';
import { evaluateAllAdjustments } from './programming';
import { log, reportError } from './observability';
import { applyRetention } from './privacy';

const { scheduledJobRuns } = schema;

export interface DailyJobsContext {
  db: Database;
  now: () => Date;
  storage: FileStorage;
}

type Step = (ctx: DailyJobsContext) => Promise<unknown>;

/** The daily work, in order: the same as `pnpm monitor:daily` and `pnpm privacy:daily`. */
export const DAILY_STEPS: Record<string, Step> = {
  monitoring: (ctx) => monitorAllClients(ctx),
  adjustments: (ctx) => evaluateAllAdjustments(ctx),
  retention: (ctx) => applyRetention(ctx),
};

/** Runs the daily jobs if nobody ran them today. Returns whether this call ran them. */
export async function runDailyJobsIfDue(
  ctx: DailyJobsContext,
  job = 'daily',
  steps: Record<string, Step> = DAILY_STEPS,
): Promise<boolean> {
  const today = localDate(ctx.now());
  const [claimed] = await ctx.db
    .insert(scheduledJobRuns)
    .values({ job, runOn: today })
    .onConflictDoNothing()
    .returning({ job: scheduledJobRuns.job });
  if (!claimed) return false;

  const result: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(steps)) {
    try {
      result[name] = await fn(ctx);
    } catch (e) {
      // One failing step never blocks the others; the error is reported (scrubbed).
      result[name] = { error: e instanceof Error ? e.name : 'Error' };
      reportError(e, { job: `${job}:${name}` });
    }
  }
  await ctx.db
    .update(scheduledJobRuns)
    .set({ finishedAt: ctx.now(), result })
    .where(and(eq(scheduledJobRuns.job, job), eq(scheduledJobRuns.runOn, today)));
  log('info', 'daily_jobs', { job, runOn: today, result });
  return true;
}
