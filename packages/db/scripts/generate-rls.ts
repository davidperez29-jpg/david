/**
 * Prints the RLS migration SQL generated from src/rls/policies.ts.
 * When the map changes: pnpm --filter @tp/db exec drizzle-kit generate --custom --name rls_vN
 * and then: pnpm --filter @tp/db rls:generate > drizzle/<that file>.sql
 */
import { generateRlsSql } from '../src/rls/generate';

process.stdout.write(generateRlsSql());
