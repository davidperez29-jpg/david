import { type AssessmentCategory } from '@/domain/assessment';
import { type Exercise, type ExerciseVariant, type Visibility } from '@/domain/library/exercise';
import { type Taxonomy } from '@/domain/library/taxonomy';
import { type FormulaDefinition } from '@/domain/formulas';
import { type DataOrigin } from '@/domain/measurement';
import { type GoalStatus } from '@/domain/goals';
import { type ClientStatus } from '@/domain/people';
import { type IsoDate } from '@/domain/time';
import {
  type AssessmentSeriesVM,
  type SessionCardVM,
  type SessionDetailVM,
  type SessionPreviewItemVM,
  type SharingSettings,
  type WeeklyVolume,
} from './shared';

export interface ClientSummaryVM {
  id: string;
  name: string;
  initials: string;
  status: ClientStatus;
  populationLabel: string;
  goal: string;
  sport: string | null;
  nextSession: { date: IsoDate; title: string } | null;
  last7Days: { completed: number; planned: number };
}

export interface TrainerDashboardVM {
  trainerName: string;
  today: IsoDate;
  activeClients: number;
  pausedClients: number;
  todaySessions: {
    clientId: string;
    clientName: string;
    initials: string;
    session: SessionCardVM;
  }[];
  week: { planned: number; completed: number; missed: number };
  activeRehabCases: number;
  recentAssessments: {
    clientId: string;
    clientName: string;
    testName: string;
    date: IsoDate;
    valueLabel: string;
    origin: DataOrigin;
  }[];
  attention: { clientId: string; clientName: string; reason: string }[];
}

/** Cabecera y datos básicos de la ficha (los usan todas las pestañas). */
export interface ClientProfileVM {
  client: ClientSummaryVM & { startedOn: IsoDate };
  sharing: SharingSettings;
  hasActiveRehab: boolean;
}

export interface GoalVM {
  id: string;
  title: string;
  areaLabel: string;
  status: GoalStatus;
  statusLabel: string;
  startedOn: IsoDate;
  targetDate: IsoDate | null;
  notes: string | null;
  /** Pruebas enlazadas con su último resultado y la comparación con el anterior (si es comparable). */
  linkedTests: AssessmentSeriesVM[];
  unlinkedTestNames: string[];
}

export interface ClientPlanVM {
  nextSession: SessionDetailVM | null;
  weekStart: IsoDate;
  days: IsoDate[];
  weekSessions: (SessionCardVM & { preview: SessionPreviewItemVM[] })[];
}

export interface ClientSessionsVM {
  upcoming: SessionCardVM[];
  past: SessionCardVM[];
}

/** Lo que el cliente registró en una sesión, serie a serie, con su valoración y observaciones. */
export interface TrainingLogEntryVM {
  sessionId: string;
  date: IsoDate;
  title: string;
  status: SessionCardVM['status'];
  completedSets: number;
  plannedSets: number;
  perceivedEffort: number | null;
  comment: string | null;
  exercises: {
    prescriptionId: string;
    slot: string;
    name: string;
    prescribed: string;
    repUnit: 'reps' | 'seconds' | 'meters';
    sets: { setNumber: number; reps: number; loadKg: number | null; completed: boolean }[];
    feedback: string | null;
  }[];
}

export interface ClientResultsVM {
  weeklyVolume: WeeklyVolume[];
  assessments: AssessmentSeriesVM[];
}

export interface PlanningVM {
  weekStart: IsoDate;
  days: IsoDate[];
  clients: {
    id: string;
    name: string;
    initials: string;
    sessions: (SessionCardVM & { preview: SessionPreviewItemVM[] })[];
  }[];
}

export interface LoadOverviewVM {
  range: { from: IsoDate; to: IsoDate };
  clients: { id: string; name: string; initials: string; weeks: WeeklyVolume[] }[];
  formulas: FormulaDefinition[];
}

export interface AssessmentsOverviewVM {
  catalog: {
    id: string;
    name: string;
    category: AssessmentCategory;
    categoryLabel: string;
    outcomeName: string;
    unit: string | null;
    status: 'protocol_pending' | 'ready';
  }[];
  byClient: { clientId: string; clientName: string; series: AssessmentSeriesVM[] }[];
}

/** Biblioteca visible para el entrenador: catálogo global + lo suyo; etiquetas personales ya fusionadas. */
export interface LibraryVM {
  taxonomy: Taxonomy;
  exercises: Exercise[];
  variants: ExerciseVariant[];
  favoriteIds: string[];
}

export interface VariantRefVM {
  id: string;
  name: string;
  isPrimary: boolean;
  visibility: Visibility;
  note?: string;
}

/** Ficha de una variante con su clasificación ya traducida a nombres. */
export interface VariantDetailVM {
  variant: ExerciseVariant;
  exercise: Exercise;
  tagGroups: {
    category: string;
    personal: boolean;
    tags: { id: string; name: string; personal: boolean }[];
  }[];
  patterns: string[];
  equipment: string[];
  regions: string[];
  environments: string[];
  steps: string[];
  stepsInheritedFrom: { id: string; name: string } | null;
  siblings: VariantRefVM[];
  progressions: VariantRefVM[];
  regressions: VariantRefVM[];
  trainerNote: string | null;
  isFavorite: boolean;
  canEdit: boolean;
}
