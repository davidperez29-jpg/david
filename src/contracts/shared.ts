/**
 * Contratos entre el servidor y la interfaz: objetos planos y serializables que los casos de
 * uso devuelven ya filtrados por permisos. Solo contienen tipos (ningún código ejecutable).
 */
import { type SharingSettings } from '@/domain/access';
import { type AssessmentTest, type Comparison } from '@/domain/assessment';
import { type DataOrigin } from '@/domain/measurement';
import { type MovementPattern } from '@/domain/exercises';
import { type CriterionStatus } from '@/domain/rehab';
import { type IsoDate } from '@/domain/time';
import { type SessionStatus } from '@/domain/training/session';
import { type WeeklyVolume } from '@/domain/training/volume';

export interface ProvenanceVM {
  origin: DataOrigin;
  method: string;
  instrument: string | null;
  formula: string | null;
  importedFrom: string | null;
  measuredOn: IsoDate;
}

export interface AssessmentSeriesVM {
  testId: string;
  testName: string;
  outcomeName: string;
  unit: string | null;
  betterWhen: AssessmentTest['betterWhen'];
  points: { date: IsoDate; value: number; provenance: ProvenanceVM }[];
  /** Comparación entre los dos últimos resultados, si los hay. */
  comparison: Comparison | null;
}

export interface SessionCardVM {
  id: string;
  date: IsoDate;
  title: string;
  focus: string;
  estimatedMinutes: number;
  exerciseCount: number;
  plannedSets: number;
  completedSets: number;
  status: SessionStatus;
}

export interface SessionPreviewItemVM {
  name: string;
  pattern: MovementPattern;
  setsAndReps: string;
}

export interface ExerciseInSessionVM {
  prescriptionId: string;
  /** Posición dentro de la sesión: A1, A2, B1… (bloque + orden dentro del bloque). */
  slot: string;
  order: number;
  exerciseId: string;
  name: string;
  pattern: MovementPattern;
  summary: string;
  steps: string[];
  cues: string[];
  videoUrl: string | null;
  sets: number;
  setsAndReps: string;
  repTargetLabel: string;
  /** Unidad de lo que se registra en cada serie. */
  repUnit: 'reps' | 'seconds' | 'meters';
  loadLabel: string;
  effortLabel: string | null;
  restSeconds: number;
  restLabel: string;
  tempo: { code: string; description: string[] } | null;
  notes: string | null;
  defaultReps: number | null;
  defaultLoadKg: number | null;
  /** Si la carga se registra en kg (y por tanto cuenta para el tonelaje). */
  tracksLoadKg: boolean;
}

export interface SessionDetailVM {
  id: string;
  date: IsoDate;
  title: string;
  focus: string;
  estimatedMinutes: number;
  coachNote: string | null;
  status: SessionStatus;
  exercises: ExerciseInSessionVM[];
}

export interface RehabCriterionVM {
  id: string;
  description: string;
  status: CriterionStatus;
  definedBy: 'trainer' | 'clinician';
  checkedOn: IsoDate | null;
}

export interface RehabPhaseVM {
  id: string;
  order: number;
  name: string;
  goal: string;
  state: 'done' | 'current' | 'upcoming';
  met: number;
  total: number;
  criteria: RehabCriterionVM[];
}

export interface RehabCaseVM {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  startedOn: IsoDate;
  phases: RehabPhaseVM[];
}

export type { SharingSettings, WeeklyVolume };
