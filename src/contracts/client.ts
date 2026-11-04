import { type IsoDate } from '@/domain/time';
import {
  type AssessmentSeriesVM,
  type SessionCardVM,
  type SessionPreviewItemVM,
  type WeeklyVolume,
} from './shared';

export interface ClientHomeVM {
  firstName: string;
  today: IsoDate;
  todaySession:
    (SessionCardVM & { coachNote: string | null; preview: SessionPreviewItemVM[] }) | null;
  nextSession: SessionCardVM | null;
  week: { completed: number; planned: number };
}

export interface ClientWeekVM {
  today: IsoDate;
  days: { date: IsoDate; sessions: SessionCardVM[] }[];
}

/** Solo contiene lo que el entrenador ha decidido compartir; lo demás llega como `null`. */
export interface ClientProgressVM {
  volume: WeeklyVolume[] | null;
  assessments: AssessmentSeriesVM[] | null;
}
