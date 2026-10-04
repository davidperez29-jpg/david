import { z } from 'zod';
import * as all from './index';

/**
 * JSON Schema (input side: what API clients send) of every exported zod schema, by export name.
 * Used by the API contract check (apps/web/test/contract.unit.test.ts) to detect breaking changes.
 */
export function contractJsonSchemas(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(all).sort(([a], [b]) => a.localeCompare(b))) {
    if (!(value instanceof z.ZodType)) continue;
    const { $schema: _ignored, ...schema } = z.toJSONSchema(value, {
      io: 'input',
      unrepresentable: 'any',
    }) as Record<string, unknown>;
    out[name] = schema;
  }
  return out;
}
