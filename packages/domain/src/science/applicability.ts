/**
 * Population applicability (anti-extrapolation, MASTER_SPECIFICATION §10.5). Compares the
 * person a recommendation is applied to with the population of the supporting studies.
 */
export type TrainingStatus =
  'untrained' | 'recreational' | 'trained' | 'highly_trained' | 'elite' | 'mixed' | 'unknown';
export type SexScope = 'female' | 'male' | 'mixed' | 'unknown';
export type Match = 'match' | 'partial' | 'mismatch' | 'unknown';

export interface PopulationFacts {
  name: string;
  ageMin: number | null;
  ageMax: number | null;
  sex: SexScope;
  trainingStatus: TrainingStatus;
  sportSlug: string | null;
}

export interface PersonFacts {
  age: number | null;
  sex: 'female' | 'male' | 'other' | 'undisclosed';
  trainingStatus: TrainingStatus | null;
  sportSlug: string | null;
}

export interface ApplicabilityResult {
  overall: Match;
  dimensions: { age: Match; sex: Match; training: Match; sport: Match };
  warnings: string[];
}

const STATUS_RANK: Partial<Record<TrainingStatus, number>> = {
  untrained: 0,
  recreational: 1,
  trained: 2,
  highly_trained: 3,
  elite: 4,
};

export function assessApplicability(
  person: PersonFacts,
  pop: PopulationFacts,
): ApplicabilityResult {
  const warnings: string[] = [];
  let age: Match = 'unknown';
  if (person.age != null && (pop.ageMin != null || pop.ageMax != null)) {
    const lo = pop.ageMin ?? 0;
    const hi = pop.ageMax ?? 120;
    if (person.age >= lo && person.age <= hi) age = 'match';
    else if (person.age >= lo - 10 && person.age <= hi + 10) age = 'partial';
    else age = 'mismatch';
    if (age !== 'match')
      warnings.push(
        `Estudio realizado en «${pop.name}», pero se aplica a una persona de ${person.age} años.`,
      );
  }
  let sex: Match = 'unknown';
  if (pop.sex === 'mixed') sex = 'match';
  else if (pop.sex !== 'unknown' && (person.sex === 'female' || person.sex === 'male')) {
    sex = pop.sex === person.sex ? 'match' : 'partial';
    if (sex === 'partial')
      warnings.push(
        `Estudio realizado mayoritaria o exclusivamente en ${pop.sex === 'male' ? 'hombres' : 'mujeres'}.`,
      );
  }
  let training: Match = 'unknown';
  const a = person.trainingStatus ? STATUS_RANK[person.trainingStatus] : undefined;
  const b = STATUS_RANK[pop.trainingStatus];
  if (pop.trainingStatus === 'mixed') training = 'match';
  else if (a != null && b != null) {
    const d = Math.abs(a - b);
    training = d === 0 ? 'match' : d === 1 ? 'partial' : 'mismatch';
    if (training !== 'match')
      warnings.push(
        `Nivel de entrenamiento distinto al de la población estudiada («${pop.name}»).`,
      );
  }
  let sport: Match;
  if (!pop.sportSlug) sport = 'match';
  else if (person.sportSlug) {
    sport = person.sportSlug === pop.sportSlug ? 'match' : 'partial';
    if (sport === 'partial') warnings.push(`Datos obtenidos en otro deporte («${pop.name}»).`);
  } else {
    sport = 'mismatch';
    warnings.push(
      `Datos obtenidos en deportistas («${pop.name}»); la persona no practica ese deporte.`,
    );
  }
  const dims = { age, sex, training, sport };
  const values = Object.values(dims);
  const overall: Match = values.includes('mismatch')
    ? 'mismatch'
    : values.includes('partial')
      ? 'partial'
      : values.every((v) => v === 'unknown')
        ? 'unknown'
        : 'match';
  return { overall, dimensions: dims, warnings };
}
