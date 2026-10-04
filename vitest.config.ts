import { defineConfig } from 'vitest/config';

/**
 * Coverage gate (MASTER_SPECIFICATION §2.3 and §15.1): ≥ 90 % of lines in the pure domain package,
 * and in each calculation engine. Run with `pnpm test:coverage` (CI).
 */
const ENGINES = ['assessment', 'monitoring', 'planning', 'decision', 'programming', 'reports'];

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['packages/domain/src/**/*.ts'],
      reporter: ['text-summary', 'text', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 90,
        functions: 90,
        ...Object.fromEntries(ENGINES.map((e) => [`packages/domain/src/${e}/**`, { lines: 90 }])),
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/*/test/**/*.unit.test.ts', 'apps/web/test/**/*.unit.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['packages/*/test/**/*.int.test.ts', 'apps/web/test/**/*.int.test.ts'],
          environment: 'node',
          globalSetup: ['./packages/application/test/global-setup.ts'],
          // Tests share one database; each test builds its own organization, so files can run
          // in parallel without truncating anything (audit_logs is append-only).
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
