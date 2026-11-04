import { type SharingSettings } from '@/domain/access';
import { type AssessmentResult } from '@/domain/assessment';
import { type Exercise } from '@/domain/exercises';
import { type Client, type Trainer } from '@/domain/people';
import { type RehabCase } from '@/domain/rehab';
import { type IsoDate } from '@/domain/time';
import { type PlannedSession, type SessionLog } from '@/domain/training/session';

/**
 * Puertos de acceso a datos. Los servicios dependen de estas interfaces, nunca de una base de
 * datos concreta: hoy las implementa un adaptador en memoria (demo) y en una fase posterior
 * lo hará PostgreSQL. Los repositorios no deciden permisos; eso lo hacen los servicios con
 * las políticas de `domain/access.ts` (y, más adelante, también la base de datos con RLS).
 */
export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

export interface TrainerRepository {
  getById(id: string): Promise<Trainer | null>;
}

export interface ClientRepository {
  listByTrainer(trainerId: string): Promise<Client[]>;
  getById(id: string): Promise<Client | null>;
}

export interface ExerciseRepository {
  list(): Promise<Exercise[]>;
  getById(id: string): Promise<Exercise | null>;
  getMany(ids: readonly string[]): Promise<Exercise[]>;
}

export interface SessionRepository {
  listByClient(clientId: string, range: DateRange): Promise<PlannedSession[]>;
  getById(id: string): Promise<PlannedSession | null>;
}

export interface SessionLogRepository {
  listByClient(clientId: string, range: DateRange): Promise<SessionLog[]>;
}

export interface AssessmentRepository {
  listByClient(clientId: string): Promise<AssessmentResult[]>;
}

export interface RehabRepository {
  listByClient(clientId: string): Promise<RehabCase[]>;
}

export interface SharingRepository {
  getForClient(clientId: string): Promise<SharingSettings | null>;
}

export interface Repositories {
  trainers: TrainerRepository;
  clients: ClientRepository;
  exercises: ExerciseRepository;
  sessions: SessionRepository;
  logs: SessionLogRepository;
  assessments: AssessmentRepository;
  rehab: RehabRepository;
  sharing: SharingRepository;
}
