import { type IsoDate } from './time';

/**
 * Readaptación: fases ordenadas con criterios de progresión. Los criterios los define el
 * profesional responsable; TrainPro no propone criterios clínicos por su cuenta.
 * Estos datos son de salud (categoría especial en el RGPD) y tienen acceso restringido.
 */
export type CriterionStatus = 'met' | 'not_met' | 'pending';

export interface ProgressionCriterion {
  id: string;
  description: string;
  status: CriterionStatus;
  definedBy: 'trainer' | 'clinician';
  checkedOn?: IsoDate;
}

export interface RehabPhase {
  id: string;
  order: number;
  name: string;
  goal: string;
  criteria: ProgressionCriterion[];
}

export interface RehabCase {
  id: string;
  clientId: string;
  title: string;
  startedOn: IsoDate;
  status: 'active' | 'closed';
  phases: RehabPhase[];
}

export function phaseProgress(phase: RehabPhase): { met: number; total: number } {
  return {
    met: phase.criteria.filter((criterion) => criterion.status === 'met').length,
    total: phase.criteria.length,
  };
}

/** Una fase se supera solo si tiene criterios y todos se cumplen. */
export function isPhaseComplete(phase: RehabPhase): boolean {
  const { met, total } = phaseProgress(phase);
  return total > 0 && met === total;
}

/** Primera fase (por orden) que aún no está superada; `null` si todas lo están. */
export function currentPhase(rehabCase: RehabCase): RehabPhase | null {
  const ordered = [...rehabCase.phases].sort((a, b) => a.order - b.order);
  return ordered.find((phase) => !isPhaseComplete(phase)) ?? null;
}
