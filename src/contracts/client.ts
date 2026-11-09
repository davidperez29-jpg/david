import { type IsoDate } from '@/domain/time';
import { type AssessmentSeriesVM, type SessionCardVM, type WeeklyVolume } from './shared';

export interface ClientWeekVM {
  today: IsoDate;
  days: { date: IsoDate; sessions: SessionCardVM[] }[];
}

/** Solo contiene lo que el entrenador ha decidido compartir; lo demás llega como `null`. */
export interface ClientProgressVM {
  volume: WeeklyVolume[] | null;
  assessments: AssessmentSeriesVM[] | null;
}
