export interface Catalog {
  goals: { id: string; slug: string; name: string; family: string; description: string | null }[];
  sports: { id: string; slug: string; name: string; family: string }[];
  equipment: { id: string; slug: string; name: string; category: string }[];
}

export interface GoalDraft {
  goalId: string;
  isPrimary: boolean;
  priorityWeight: number;
  targetDate: string;
  sportId: string;
  competitiveLevel: string;
}

export interface SlotDraft {
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface EquipmentDraft {
  equipmentId: string;
  location: 'home' | 'gym' | 'both';
}

export const toGoalPayload = (g: GoalDraft[]) =>
  g.map((x) => ({
    goalId: x.goalId,
    isPrimary: x.isPrimary,
    priorityWeight: x.priorityWeight,
    targetDate: x.targetDate || null,
    sportId: x.sportId || null,
    competitiveLevel: x.competitiveLevel || null,
  }));

export const toSlotPayload = (s: SlotDraft[]) =>
  s.map((x) => ({
    weekday: x.weekday,
    startTime: x.startTime || null,
    endTime: x.endTime || null,
  }));
