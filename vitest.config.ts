import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
