import { describe, expect, it } from 'vitest';
import { canAdaptExercise, canEditExercise, canViewExercise, type Actor } from '../access';
import {
  adaptVariant,
  effectiveSteps,
  type Exercise,
  type ExerciseVariant,
  libraryIssues,
  progressionsOf,
  regressionsOf,
} from './exercise';
import { searchLibrary, toggleFilter } from './search';
import {
  findTagConflict,
  isLeaf,
  isWithin,
  SYSTEM_TAXONOMY,
  taxonomyIssues,
  type Tag,
} from './taxonomy';

const alex: Actor = { role: 'trainer', trainerId: 't-alex' };
const other: Actor = { role: 'trainer', trainerId: 't-otro' };
const client: Actor = { role: 'client', clientId: 'c1', trainerId: 't-alex' };

const exercises: Exercise[] = [
  {
    id: 'x-squat',
    name: 'Sentadilla',
    summary: '',
    owner: { kind: 'system' },
    visibility: 'global',
  },
  { id: 'x-row', name: 'Remo', summary: '', owner: { kind: 'system' }, visibility: 'global' },
];

const base: Omit<ExerciseVariant, 'id' | 'name' | 'exerciseId'> = {
  owner: { kind: 'system' },
  visibility: 'global',
  isPrimary: false,
  description: '',
  objective: '',
  steps: [],
  cues: [],
  commonMistakes: [],
  technicalNotes: [],
  tagIds: [],
  patterns: [],
  regionIds: [],
  equipmentIds: ['bodyweight'],
  environmentIds: ['gym'],
  laterality: 'bilateral',
  complexity: 'basic',
  silhouette: 'squat',
  media: { links: [] },
};

const v = (
  id: string,
  exerciseId: string,
  name: string,
  extra: Partial<ExerciseVariant>,
): ExerciseVariant => ({
  ...base,
  id,
  exerciseId,
  name,
  ...extra,
});

const variants: ExerciseVariant[] = [
  v('back', 'x-squat', 'Sentadilla trasera', {
    isPrimary: true,
    steps: ['Paso 1'],
    tagIds: ['max-strength', 'general-strength'],
    patterns: [{ id: 'lower.knee', role: 'primary' }],
    equipmentIds: ['barbell', 'rack'],
    complexity: 'intermediate',
  }),
  v('jump', 'x-squat', 'Sentadilla con salto', {
    tagIds: ['power', 'ballistic'],
    patterns: [{ id: 'lower.mixed', role: 'primary' }],
  }),
  v('iso', 'x-squat', 'Sentadilla isométrica', {
    tagIds: ['isometric'],
    patterns: [{ id: 'lower.knee', role: 'primary' }],
    environmentIds: ['home'],
  }),
  v('row', 'x-row', 'Remo con mancuerna', {
    isPrimary: true,
    steps: ['Tirar'],
    tagIds: ['general-strength'],
    patterns: [{ id: 'pull.horizontal', role: 'primary' }],
    laterality: 'unilateral',
    equipmentIds: ['dumbbell', 'bench'],
  }),
];

const query = (
  filters: { facet: 'tag' | 'pattern' | 'equipment' | 'laterality'; id: string }[],
  mode: 'all' | 'any',
  text = '',
) => searchLibrary(variants, exercises, { text, filters, mode }, SYSTEM_TAXONOMY).map((x) => x.id);

describe('taxonomía de la biblioteca', () => {
  it('es íntegra e incluye las dimensiones de la especificación', () => {
    expect(taxonomyIssues(SYSTEM_TAXONOMY)).toEqual([]);
    const active = SYSTEM_TAXONOMY.tags.filter((t) => !t.archived);
    const byCategory = (id: string) => active.filter((t) => t.categoryId === id).map((t) => t.id);
    expect(byCategory('capacity')).toHaveLength(11);
    expect(byCategory('method')).toEqual([
      'plyometric',
      'contrast',
      'oscillatory',
      'ballistic',
      'max-velocity-intent',
    ]);
    expect(byCategory('muscle-action')).toEqual(['concentric', 'eccentric', 'isometric', 'ssc']);
    expect(byCategory('application')).toEqual(['one-rm-test', 'percent-1rm']);
    expect(SYSTEM_TAXONOMY.patterns.filter((p) => p.parentId === null).map((p) => p.id)).toEqual([
      'push',
      'pull',
      'lower',
      'trunk-anti',
      'trunk-dynamic',
      'hip-motion',
      'locomotion',
      'jump',
      'landing',
      'carry',
    ]);
  });

  it('1RM ya no se mezcla con las cualidades: la etiqueta antigua se archiva y se sustituye', () => {
    const old = SYSTEM_TAXONOMY.tags.find((t) => t.id === 'one-rm');
    expect(old?.archived).toBe(true);
    expect(old?.replacedBy).toEqual(['one-rm-test', 'percent-1rm']);
    expect(SYSTEM_TAXONOMY.tagCategories.find((c) => c.id === 'control')?.archived).toBe(true);
    // Ninguna cualidad pertenece a la categoría de aplicaciones, ni al revés.
    expect(SYSTEM_TAXONOMY.tags.find((t) => t.id === 'hypertrophy')?.categoryId).toBe('capacity');
    expect(SYSTEM_TAXONOMY.tags.find((t) => t.id === 'one-rm-test')?.categoryId).toBe(
      'application',
    );
  });

  it('distingue la cadera del tronco y los subtipos son hojas', () => {
    expect(isLeaf(SYSTEM_TAXONOMY.patterns, 'hip-motion.flexion')).toBe(true);
    expect(isLeaf(SYSTEM_TAXONOMY.patterns, 'hip-motion')).toBe(false);
    expect(isWithin(SYSTEM_TAXONOMY.patterns, 'hip-motion.flexion', 'trunk-dynamic')).toBe(false);
    expect(isWithin(SYSTEM_TAXONOMY.patterns, 'trunk-dynamic.flexion', 'hip-motion')).toBe(false);
  });

  it('los patrones son jerárquicos: un subtipo pertenece a su grupo', () => {
    expect(isWithin(SYSTEM_TAXONOMY.patterns, 'pull.horizontal', 'pull')).toBe(true);
    expect(isWithin(SYSTEM_TAXONOMY.patterns, 'pull.horizontal', 'push')).toBe(false);
    expect(isWithin(SYSTEM_TAXONOMY.equipment, 'bench', 'other')).toBe(true);
  });

  it('evita etiquetas duplicadas sin distinguir tildes ni mayúsculas', () => {
    const own: Tag = {
      id: 'warm-up',
      categoryId: 'control',
      name: 'Calentamiento',
      owner: { kind: 'trainer', trainerId: 't-alex' },
    };
    const tags = [...SYSTEM_TAXONOMY.tags, own];
    expect(findTagConflict(tags, 'pliometria', 't-alex')?.id).toBe('plyometric');
    expect(findTagConflict(tags, 'CALENTAMIENTO', 't-alex')?.id).toBe('warm-up');
    // La etiqueta personal de Alex no bloquea a otro entrenador.
    expect(findTagConflict(tags, 'Calentamiento', 't-otro')).toBeNull();
  });
});

describe('búsqueda avanzada', () => {
  it('AND: cumple todos los filtros (Potencia + Patrón mixto)', () => {
    expect(
      query(
        [
          { facet: 'tag', id: 'power' },
          { facet: 'pattern', id: 'lower.mixed' },
        ],
        'all',
      ),
    ).toEqual(['jump']);
  });

  it('OR: cumple al menos uno', () => {
    expect(
      query(
        [
          { facet: 'tag', id: 'power' },
          { facet: 'tag', id: 'isometric' },
        ],
        'any',
      ),
    ).toEqual(['jump', 'iso']);
  });

  it('un grupo de patrones incluye sus subtipos (Tracción ⊃ Tracción horizontal)', () => {
    expect(query([{ facet: 'pattern', id: 'pull' }], 'all')).toEqual(['row']);
    expect(
      query(
        [
          { facet: 'pattern', id: 'pull' },
          { facet: 'laterality', id: 'unilateral' },
        ],
        'all',
      ),
    ).toEqual(['row']);
  });

  it('una variante no hereda la clasificación de su ejercicio principal', () => {
    expect(query([{ facet: 'tag', id: 'max-strength' }], 'all')).toEqual(['back']);
  });

  it('combina texto (siempre obligatorio) con filtros y busca sin tildes', () => {
    expect(query([], 'all', 'isometrica')).toEqual(['iso']);
    expect(query([{ facet: 'tag', id: 'general-strength' }], 'any', 'remo')).toEqual(['row']);
  });

  it('puede limitar los filtros de patrón al patrón principal', () => {
    const withSecondary = variants.map((x) =>
      x.id === 'jump'
        ? {
            ...x,
            patterns: [
              { id: 'jump.vertical', role: 'primary' as const },
              { id: 'lower.mixed', role: 'secondary' as const },
            ],
          }
        : x,
    );
    const search = (patternRole: 'any' | 'primary') =>
      searchLibrary(
        withSecondary,
        exercises,
        { filters: [{ facet: 'pattern', id: 'lower.mixed' }], mode: 'all', patternRole },
        SYSTEM_TAXONOMY,
      ).map((x) => x.id);
    expect(search('any')).toEqual(['jump']);
    expect(search('primary')).toEqual([]);
  });

  it('busca por palabras en cualquier dato, incluida la ejecución', () => {
    expect(query([], 'all', 'remo unilateral')).toEqual(['row']);
    expect(query([], 'all', 'remo bilateral')).toEqual([]);
  });

  it('añade y quita filtros', () => {
    const one = toggleFilter([], { facet: 'tag', id: 'power' });
    expect(one).toHaveLength(1);
    expect(toggleFilter(one, { facet: 'tag', id: 'power' })).toEqual([]);
  });
});

describe('variantes, progresiones e integridad', () => {
  const library = {
    exercises,
    variants,
    links: [{ fromVariantId: 'iso', toVariantId: 'back', owner: { kind: 'system' as const } }],
  };

  it('una variante sin instrucciones propias muestra las de la variante de referencia', () => {
    const { steps, inheritedFrom } = effectiveSteps(variants[1]!, variants);
    expect(steps).toEqual(['Paso 1']);
    expect(inheritedFrom?.id).toBe('back');
  });

  it('las progresiones son dirigidas y su inversa es la regresión', () => {
    expect(progressionsOf('iso', library.links)).toEqual(['back']);
    expect(regressionsOf('back', library.links)).toEqual(['iso']);
  });

  it('detecta datos inconsistentes', () => {
    expect(libraryIssues(library, SYSTEM_TAXONOMY)).toEqual([]);
    const broken = {
      exercises,
      variants: [
        ...variants,
        v('bad', 'x-row', 'Malo', { isPrimary: true, tagIds: ['no-existe'] }),
      ],
      links: [{ fromVariantId: 'back', toVariantId: 'back', owner: { kind: 'system' as const } }],
    };
    const issues = libraryIssues(broken, SYSTEM_TAXONOMY);
    expect(issues).toContain('bad: valor desconocido en etiquetas «no-existe».');
    expect(issues).toContain('x-row: debe tener exactamente una variante de referencia (tiene 2).');
    expect(issues).toContain('Progresión de una variante hacia sí misma: back.');
  });

  it('exige un único patrón principal, subtipos (no grupos) y etiquetas vigentes', () => {
    const bad = v('bad', 'x-row', 'Malo', {
      tagIds: ['one-rm'],
      patterns: [
        { id: 'pull', role: 'primary' },
        { id: 'pull.horizontal', role: 'primary' },
      ],
    });
    const issues = libraryIssues(
      { exercises, variants: [...variants, bad], links: [] },
      SYSTEM_TAXONOMY,
    );
    expect(issues).toContain('bad: usa la etiqueta archivada «one-rm».');
    expect(issues).toContain('bad: asigna el grupo «pull»; usa un subtipo.');
    expect(issues).toContain('bad: debe tener exactamente un patrón principal (tiene 2).');
  });
});

describe('adaptar un ejercicio global', () => {
  it('crea una copia personalizada y deja intacto el original', () => {
    const original = variants[0]!;
    const snapshot = structuredClone(original);
    const copy = adaptVariant(original, 't-alex', 'mi-sentadilla', {
      name: 'Mi sentadilla',
      tagIds: ['general-strength'],
    });
    expect(original).toEqual(snapshot);
    expect(copy).toMatchObject({
      id: 'mi-sentadilla',
      name: 'Mi sentadilla',
      owner: { kind: 'trainer', trainerId: 't-alex' },
      visibility: 'trainer',
      isPrimary: false,
      derivedFrom: { variantId: original.id },
      exerciseId: original.exerciseId,
    });
    copy.steps.push('Cambio solo en la copia');
    expect(original.steps).toEqual(snapshot.steps);
  });

  it('no permite reutilizar el id del original', () => {
    expect(() => adaptVariant(variants[0]!, 't-alex', variants[0]!.id)).toThrow();
  });
});

describe('permisos de la biblioteca', () => {
  const own = {
    owner: { kind: 'trainer' as const, trainerId: 't-alex' },
    visibility: 'private' as const,
  };
  const global = { owner: { kind: 'system' as const }, visibility: 'global' as const };

  it('el catálogo global lo ven todos los entrenadores, pero nadie lo edita', () => {
    expect(canViewExercise(other, global)).toBe(true);
    expect(canEditExercise(alex, global)).toBe(false);
  });

  it('un ejercicio privado solo lo ve y edita su propietario', () => {
    expect(canViewExercise(alex, own)).toBe(true);
    expect(canEditExercise(alex, own)).toBe(true);
    expect(canViewExercise(other, own)).toBe(false);
    expect(canEditExercise(other, own)).toBe(false);
  });

  it('los clientes no navegan por la biblioteca', () => {
    expect(canViewExercise(client, global)).toBe(false);
  });

  it('la administración gestiona el catálogo global, pero no ve lo personal ni lo adapta', () => {
    const admin: Actor = { role: 'admin', adminId: 'a1' };
    expect(canEditExercise(admin, global)).toBe(true);
    expect(canViewExercise(admin, own)).toBe(false);
    expect(canEditExercise(admin, own)).toBe(false);
    expect(canAdaptExercise(admin, global)).toBe(false);
  });

  it('un entrenador adapta ejercicios globales (no edita el original)', () => {
    expect(canAdaptExercise(alex, global)).toBe(true);
    expect(canEditExercise(alex, global)).toBe(false);
    expect(canAdaptExercise(alex, own)).toBe(false);
  });
});
