import 'server-only';
import { connection } from 'next/server';
import { type ClientActor, type TrainerActor } from '@/domain/access';
import { type IsoDate, todayInTimeZone } from '@/domain/time';
import { readServerEnv } from './env';
import { getDemoRepositories } from './repositories/demo';
import { DEMO_CLIENT_ID, DEMO_TRAINER_ID } from './repositories/demo/dataset';
import { type Repositories } from './repositories/ports';

/**
 * Contexto de cada petición: quién la hace, qué día es y con qué datos se trabaja.
 * Todos los casos de uso lo reciben, de modo que los permisos se aplican siempre en el servidor.
 */
export interface RequestContext<A> {
  actor: A;
  today: IsoDate;
  repos: Repositories;
}
export type TrainerContext = RequestContext<TrainerActor>;
export type ClientContext = RequestContext<ClientActor>;

async function baseContext() {
  // Los datos dependen de la petición (fecha y, en el futuro, la sesión del usuario).
  await connection();
  const env = readServerEnv();
  const today = todayInTimeZone(env.timeZone);
  return { today, repos: getDemoRepositories(today) };
}

/**
 * SESIÓN DE DEMOSTRACIÓN: no hay autenticación real. Estas dos funciones son el único punto
 * que cambiará cuando llegue el inicio de sesión: el actor saldrá de una sesión verificada.
 */
export async function getTrainerContext(): Promise<TrainerContext> {
  return { ...(await baseContext()), actor: { role: 'trainer', trainerId: DEMO_TRAINER_ID } };
}

export async function getClientContext(): Promise<ClientContext> {
  return {
    ...(await baseContext()),
    actor: { role: 'client', clientId: DEMO_CLIENT_ID, trainerId: DEMO_TRAINER_ID },
  };
}
