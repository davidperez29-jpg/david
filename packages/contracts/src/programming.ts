import { z } from 'zod';
import { isoDate, optionalText } from './common';
import { weekdays } from './planning';

/** Generate a PROPOSAL plan from the latest decision run (§12.2.5). */
export const planProposalSchema = z.object({
  /** Defaults to the template the decision engine proposed. */
  templateId: z.uuid().optional(),
  startDate: isoDate,
  weekdays,
});

export const acceptPlanProposalSchema = z.object({
  name: optionalText(120),
  reason: optionalText(500),
  /**
   * draft: the proposal becomes a new plan in draft (default). revision: its future sessions
   * replace the unrecorded future sessions of the active plan, as a new revision (phase 13).
   */
  mode: z.enum(['draft', 'revision']).default('draft'),
});

export const discardPlanProposalSchema = z.object({ reason: optionalText(500) });

/** Parameters the trainer can edit before accepting an adjustment ("Editar"). */
export const adjustmentParamsSchema = z.object({
  toKg: z.coerce.number().min(0).max(1000).optional(),
  setsDelta: z.coerce.number().int().min(-3).max(0).optional(),
  rirDelta: z.coerce.number().int().min(0).max(4).optional(),
  toExerciseId: z.uuid().optional(),
});

export const decideAdjustmentSchema = z.object({
  action: z.enum(['accept', 'accept_with_changes', 'reject', 'postpone']),
  params: adjustmentParamsSchema.optional(),
  reason: optionalText(500),
});

export const bulkAdjustmentsSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(100),
  reason: optionalText(500),
});

export const revertAdjustmentSchema = z.object({ reason: optionalText(500) });

export const autoApplySchema = z.object({ enabled: z.boolean() });
