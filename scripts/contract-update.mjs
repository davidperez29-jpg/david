// Accepts the current API contract into docs/api/contract.json (see apps/web/test/contract.unit.test.ts).
// `--breaking` also accepts breaking changes: record them in the CHANGELOG.
import { spawnSync } from 'node:child_process';

const mode = process.argv.includes('--breaking') ? 'breaking' : '1';
const r = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', '--project', 'unit', 'apps/web/test/contract.unit.test.ts'],
  {
    stdio: 'inherit',
    env: { ...process.env, CONTRACT_UPDATE: mode },
  },
);
process.exit(r.status ?? 1);
