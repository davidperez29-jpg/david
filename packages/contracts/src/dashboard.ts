import { z } from 'zod';
import { isoDate } from './common';

export const calendarQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  clientId: z.uuid().optional(),
  trainerId: z.uuid().optional(),
});

/** Tests shown to the client in "Progreso" (§9.5): up to 5; empty = all. */
export const progressMetricsSchema = z.object({
  testIds: z.array(z.uuid()).max(5),
});
