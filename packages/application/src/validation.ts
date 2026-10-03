import { DomainError } from '@tp/domain';
import type { z } from 'zod';

/** Parses input with a contract schema; maps failures to a `validation` DomainError. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input);
  if (!r.success) {
    const details: Record<string, string[]> = {};
    for (const issue of r.error.issues) {
      const key = issue.path.join('.') || '_';
      (details[key] ??= []).push(issue.message);
    }
    throw new DomainError('validation', 'Datos no válidos.', details);
  }
  return r.data;
}
