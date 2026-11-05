import { type IsoDate } from './time';

/**
 * Objetivos del cliente. Pueden enlazarse con pruebas de evaluación para seguir su evolución;
 * TrainPro no fija valores objetivo «normativos»: si hay una meta numérica, la define el profesional.
 */
export type GoalArea = 'performance' | 'strength' | 'health' | 'return_to_sport' | 'habit';
export type GoalStatus = 'active' | 'achieved' | 'paused';

export const GOAL_AREA_LABELS: Record<GoalArea, string> = {
  performance: 'Rendimiento',
  strength: 'Fuerza',
  health: 'Salud y autonomía',
  return_to_sport: 'Retorno al deporte',
  habit: 'Hábito',
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: 'En curso',
  achieved: 'Conseguido',
  paused: 'En pausa',
};

export interface Goal {
  id: string;
  clientId: string;
  title: string;
  area: GoalArea;
  status: GoalStatus;
  startedOn: IsoDate;
  targetDate?: IsoDate;
  /** Pruebas de evaluación con las que se sigue este objetivo. */
  linkedTestIds: string[];
  notes?: string;
}
