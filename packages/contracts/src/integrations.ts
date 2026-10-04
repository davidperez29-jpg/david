import { z } from 'zod';

/** Generic adapters available before any vendor integration (Phase 15). */
export const EXTERNAL_PROVIDERS = ['json', 'csv'] as const;

export const externalImportSchema = z.object({
  provider: z.enum(EXTERNAL_PROVIDERS),
  /** The exported file as text (JSON array or CSV), 1 MB max. */
  content: z.string().min(2).max(1_000_000),
  device: z.string().trim().max(120).optional(),
});

export const externalListSchema = z.object({
  type: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
