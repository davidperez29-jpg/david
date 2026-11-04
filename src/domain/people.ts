import { type IsoDate } from './time';

export interface Trainer {
  id: string;
  displayName: string;
}

export type ClientStatus = 'active' | 'paused';

/** Población de referencia: orienta qué evaluaciones y referencias tienen sentido. */
export type Population = 'general_health' | 'performance' | 'older_adult' | 'return_to_sport';

export const POPULATION_LABELS: Record<Population, string> = {
  general_health: 'Salud y condición física',
  performance: 'Rendimiento deportivo',
  older_adult: 'Personas mayores',
  return_to_sport: 'Readaptación y retorno',
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Activo',
  paused: 'En pausa',
};

/**
 * Datos mínimos del cliente (minimización de datos). La información de salud y lesiones
 * no vive aquí: está en módulos separados con un acceso más restringido.
 */
export interface Client {
  id: string;
  trainerId: string;
  displayName: string;
  status: ClientStatus;
  population: Population;
  goal: string;
  sport?: string;
  startedOn: IsoDate;
}
