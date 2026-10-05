import { schema } from '@tp/db';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { DAILY_STEPS, LocalDiskStorage, runDailyJobsIfDue } from '../src';
import { buildOrg, testDb } from './fixtures';

describe('daily jobs inside the app (deployment without a paid cron)', () => {
  it('run once per day, whatever the number of instances or restarts', async () => {
    await buildOrg();
    // Stub steps: the real ones act on the whole (shared) test database.
    const ran: string[] = [];
    const steps = {
      monitoring: async () => (ran.push('monitoring'), { clients: 0 }),
      failing: async () => {
        throw new Error('boom');
      },
      retention: async () => (ran.push('retention'), { anonymized: 0 }),
    };
    const ctx = {
      db: testDb().db,
      now: () => new Date('2031-03-04T10:00:00Z'),
      storage: new LocalDiskStorage(mkdtempSync(join(tmpdir(), 'tp-daily-'))),
    };
    // Two instances waking up at the same time: only one runs.
    const both = await Promise.all([
      runDailyJobsIfDue(ctx, 'daily-test', steps),
      runDailyJobsIfDue(ctx, 'daily-test', steps),
    ]);
    expect(both.filter(Boolean)).toHaveLength(1);
    expect(await runDailyJobsIfDue(ctx, 'daily-test', steps)).toBe(false);
    // A failing step does not stop the next one.
    expect(ran).toEqual(['monitoring', 'retention']);
    const [row] = await ctx.db
      .select()
      .from(schema.scheduledJobRuns)
      .where(eq(schema.scheduledJobRuns.job, 'daily-test'));
    expect(row!.runOn).toBe('2031-03-04');
    expect(row!.finishedAt).not.toBeNull();
    expect(row!.result).toEqual({
      monitoring: { clients: 0 },
      failing: { error: 'Error' },
      retention: { anonymized: 0 },
    });
    // Production runs the same work as the daily scripts.
    expect(Object.keys(DAILY_STEPS)).toEqual(['monitoring', 'adjustments', 'retention']);
    // The next day runs again.
    expect(
      await runDailyJobsIfDue(
        { ...ctx, now: () => new Date('2031-03-05T10:00:00Z') },
        'daily-test',
        steps,
      ),
    ).toBe(true);
  });
});
