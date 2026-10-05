/** Runs once per server start (Next.js instrumentation hook). */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.DAILY_JOBS === 'in-app') {
    const { startDailyJobs } = await import('./server/daily-jobs');
    startDailyJobs();
  }
}
