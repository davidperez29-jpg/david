import { type AssessmentCategory } from '@/domain/assessment';
import { type Exercise } from '@/domain/exercises';
import { type FormulaDefinition } from '@/domain/formulas';
import { type DataOrigin } from '@/domain/measurement';
import { type ClientStatus } from '@/domain/people';
import { type IsoDate } from '@/domain/time';
import {
  type AssessmentSeriesVM,
  type RehabCaseVM,
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

export interface ClientOverviewVM {
  client: ClientSummaryVM & { startedOn: IsoDate };
  sharing: SharingSettings;
  upcoming: SessionCardVM[];
  recent: SessionCardVM[];
  nextSessionDetail: SessionDetailVM | null;
  weeklyVolume: WeeklyVolume[];
  assessments: AssessmentSeriesVM[];
  rehab: RehabCaseVM | null;
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

export type ExerciseLibraryVM = Exercise[];
