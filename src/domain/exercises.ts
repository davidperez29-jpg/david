import { matchesSearch } from './text';

export const MOVEMENT_PATTERNS = [
  'squat',
  'hinge',
  'lunge',
  'push',
  'pull',
  'carry',
  'core',
  'jump',
  'sprint',
  'accessory',
  'mobility',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const MOVEMENT_PATTERN_LABELS: Record<MovementPattern, string> = {
  squat: 'Sentadilla',
  hinge: 'Bisagra de cadera',
  lunge: 'Zancada y unilateral',
  push: 'Empuje',
  pull: 'Tracción',
  carry: 'Transporte',
  core: 'Core',
  jump: 'Salto',
  sprint: 'Carrera y aceleración',
  accessory: 'Accesorio',
  mobility: 'Movilidad',
};

export type ExerciseLevel = 'basic' | 'intermediate' | 'advanced';

export const EXERCISE_LEVEL_LABELS: Record<ExerciseLevel, string> = {
  basic: 'Básico',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

export interface ExerciseMedia {
  /** Vídeo propio o enlazado. Si falta, se muestra la silueta del patrón. */
  videoUrl?: string;
  links: { label: string; url: string }[];
}

export interface Exercise {
  id: string;
  name: string;
  pattern: MovementPattern;
  equipment: string[];
  level: ExerciseLevel;
  summary: string;
  steps: string[];
  cues: string[];
  commonMistakes: string[];
  media: ExerciseMedia;
}

export interface ExerciseFilter {
  query?: string;
  pattern?: MovementPattern | 'all';
}

export function filterExercises(
  exercises: readonly Exercise[],
  filter: ExerciseFilter,
): Exercise[] {
  return exercises.filter((exercise) => {
    if (filter.pattern && filter.pattern !== 'all' && exercise.pattern !== filter.pattern) {
      return false;
    }
    return matchesSearch(
      [exercise.name, MOVEMENT_PATTERN_LABELS[exercise.pattern], ...exercise.equipment],
      filter.query ?? '',
    );
  });
}

/** Solo se aceptan enlaces https para vídeos y recursos externos. */
export function isSafeExternalUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
