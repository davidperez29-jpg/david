import { type SharingSettings } from '@/domain/access';
import { type AssessmentResult } from '@/domain/assessment';
import {
  type Exercise,
  type ExerciseVariant,
  type Favorite,
  type ProgressionLink,
  type TrainerExerciseNote,
} from '@/domain/library/exercise';
import { type Tag, type TagCategory } from '@/domain/library/taxonomy';
import { type Goal } from '@/domain/goals';
import { type Client, type Trainer } from '@/domain/people';
import { type RehabCase } from '@/domain/rehab';
import { type IsoDate } from '@/domain/time';
import { type PlannedSession, type SessionLog } from '@/domain/training/session';
import { type SessionLogV2, type SetLogV2 } from '@/domain/training/execution';
import {
  type SessionContent,
  type SessionVersion,
  type TrainingSession,
} from '@/domain/training/session-v2';

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

/**
 * Biblioteca de ejercicios. Devuelve también elementos de otros propietarios: los casos de uso
 * filtran con `canViewExercise` y `visibleTo` (con PostgreSQL, además, RLS por propietario).
 */
export interface LibraryRepository {
  /** Categorías y etiquetas personalizadas de los entrenadores (las del sistema están en el dominio). */
  customTagCategories(): Promise<TagCategory[]>;
  customTags(): Promise<Tag[]>;
  /** Etiquetas personales que un entrenador ha aplicado a variantes (también globales). */
  personalTagging(trainerId: string): Promise<{ variantId: string; tagId: string }[]>;
  exercises(): Promise<Exercise[]>;
  variants(): Promise<ExerciseVariant[]>;
  getVariants(ids: readonly string[]): Promise<ExerciseVariant[]>;
  /** Variantes de referencia de los ejercicios principales indicados. */
  primaryVariants(exerciseIds: readonly string[]): Promise<ExerciseVariant[]>;
  progressions(): Promise<ProgressionLink[]>;
  notes(trainerId: string): Promise<TrainerExerciseNote[]>;
  favorites(trainerId: string): Promise<Favorite[]>;
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

export interface GoalRepository {
  listByClient(clientId: string): Promise<Goal[]>;
}

export interface RehabRepository {
  listByClient(clientId: string): Promise<RehabCase[]>;
}

export interface SharingRepository {
  getForClient(clientId: string): Promise<SharingSettings | null>;
}

/**
 * Prescripción v2 (docs/V1_SPEC.md §4): borradores, versiones y ejecución. Cada operación de
 * escritura es UNA transacción y devuelve un resultado explícito; los permisos los aplican los
 * casos de uso. Esta interfaz es la que implementará el adaptador de PostgreSQL (§8.3.4).
 */
export type CreateDraftResult = 'created' | 'exists';

export type SaveDraftResult =
  | { result: 'saved'; revision: number }
  /** El mismo contenido ya estaba guardado (reintento): no hay conflicto. */
  | { result: 'unchanged'; revision: number }
  | { result: 'conflict'; revision: number }
  | { result: 'not_found' }
  | { result: 'no_draft' };

export type PublishResult =
  | { result: 'published'; version: SessionVersion }
  /** Reintento de una publicación ya hecha con el mismo contenido. */
  | { result: 'already_published'; version: SessionVersion }
  | { result: 'conflict'; revision: number }
  | { result: 'not_found' }
  | { result: 'no_draft' };

export interface PublishInput {
  sessionId: string;
  expectedRevision: number;
  content: SessionContent;
  versionId: string;
  publishedAt: string;
  publishedBy: string;
  reason?: string;
  changes: SessionVersion['changes'];
  executionState: SessionVersion['executionState'];
}

export interface TrainingRepository {
  getSession(id: string): Promise<TrainingSession | null>;
  /** Sesiones del cliente (también borradores), por fecha prevista y orden en el día. */
  listSessions(clientId: string, range?: DateRange): Promise<TrainingSession[]>;
  createDraft(session: TrainingSession): Promise<CreateDraftResult>;
  saveDraft(input: {
    sessionId: string;
    expectedRevision: number;
    content: SessionContent;
    updatedAt: string;
  }): Promise<SaveDraftResult>;
  /** Solo borradores que nunca se han publicado. */
  deleteDraft(sessionId: string): Promise<'deleted' | 'not_found' | 'not_deletable'>;
  /** Abre un borrador de cambios a partir de la versión vigente. */
  startChangeDraft(
    sessionId: string,
    updatedAt: string,
  ): Promise<'started' | 'exists' | 'not_found' | 'not_published'>;
  discardChangeDraft(sessionId: string, updatedAt: string): Promise<'discarded' | 'not_found'>;
  publish(input: PublishInput): Promise<PublishResult>;
  getVersion(sessionId: string, number: number): Promise<SessionVersion | null>;
  listVersions(sessionId: string): Promise<SessionVersion[]>;
  getExecution(sessionId: string): Promise<{ log: SessionLogV2; setLogs: SetLogV2[] } | null>;
}

export interface Repositories {
  trainers: TrainerRepository;
  clients: ClientRepository;
  library: LibraryRepository;
  sessions: SessionRepository;
  logs: SessionLogRepository;
  assessments: AssessmentRepository;
  goals: GoalRepository;
  rehab: RehabRepository;
  sharing: SharingRepository;
  training: TrainingRepository;
}
