import 'server-only';
import { reportError, runDailyJobsIfDue } from '@tp/application';
import { baseContext } from './context';

const HOUR = 60 * 60 * 1000;

/**
 * DAILY_JOBS=in-app: the monitoring and privacy jobs run inside the server, once a day (checked at
 * start-up and every hour). For hosts without a paid cron; with a cron, leave it unset and schedule
 * `pnpm monitor:daily` and `pnpm privacy:daily` instead (docs/OPERATIONS.md).
 */
export function startDailyJobs(): void {
  const tick = () => {
    const { db, storage, now } = baseContext();
    runDailyJobsIfDue({ db, storage, now }).catch((e) => reportError(e, { job: 'daily' }));
  };
  setTimeout(tick, 30_000).unref();
  setInterval(tick, HOUR).unref();
}
