/**
 * The three programming levels (brief §4). How a level changes the programming, dimension by
 * dimension: the same scale for every profile; each profile adds its own one-line summary
 * (programming_profiles.levels). Practical descriptors, not scientific claims.
 */
export type ProgrammingLevel = 1 | 2 | 3;

export const LEVEL_NAMES: Record<ProgrammingLevel, string> = {
  1: 'Inicial',
  2: 'Intermedio',
  3: 'Avanzado',
};

export const LEVEL_DIMENSIONS: { key: string; label: string; levels: [string, string, string] }[] =
  [
    {
      key: 'complejidad',
      label: 'Complejidad',
      levels: [
        'Ejercicios estables y simples',
        'Libres y unilaterales',
        'Combinados y específicos',
      ],
    },
    {
      key: 'intensidad',
      label: 'Intensidad',
      levels: ['Moderada, lejos del fallo', 'Alta con autorregulación', 'Alta y muy alta, picos'],
    },
    {
      key: 'volumen',
      label: 'Volumen',
      levels: ['Bajo-moderado', 'Moderado-alto', 'Alto y periodizado'],
    },
    {
      key: 'densidad',
      label: 'Densidad',
      levels: [
        'Descansos amplios',
        'Descansos ajustados al objetivo',
        'Densidad alta cuando procede',
      ],
    },
    {
      key: 'especificidad',
      label: 'Especificidad',
      levels: ['General', 'Orientada al objetivo', 'Muy específica'],
    },
    {
      key: 'velocidad',
      label: 'Velocidad',
      levels: ['Controlada', 'Intencional en la fase concéntrica', 'Máxima cuando procede'],
    },
    {
      key: 'demanda_neuromuscular',
      label: 'Demanda neuromuscular',
      levels: ['Baja', 'Moderada', 'Alta (pliometría intensa, sprint, cargas altas)'],
    },
    {
      key: 'control_tecnico',
      label: 'Control técnico',
      levels: [
        'En aprendizaje',
        'Consolidado en los básicos',
        'Consolidado en variantes complejas',
      ],
    },
    {
      key: 'tolerancia',
      label: 'Tolerancia',
      levels: ['En construcción', 'Buena a cargas habituales', 'Alta y estable'],
    },
    {
      key: 'experiencia',
      label: 'Experiencia',
      levels: ['Sin experiencia o poca', 'Regular y continuada', 'Amplia'],
    },
  ];

/**
 * Starting suggestion from the declared experience only. The trainer decides; the evaluation (and
 * not age or diagnosis alone) refines it later (brief §36–§37).
 */
export function suggestLevel(
  experience: 'none' | 'beginner' | 'intermediate' | 'advanced' | null | undefined,
): ProgrammingLevel {
  if (experience === 'advanced') return 3;
  if (experience === 'intermediate') return 2;
  return 1;
}
