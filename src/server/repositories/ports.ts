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
}
