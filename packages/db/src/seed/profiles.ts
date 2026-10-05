/**
 * Programming profiles (restructure phase 1, docs/PRODUCT_ARCHITECTURE.md): the client's main
 * profile with three levels. Level texts are practical descriptors of how programming changes
 * (complexity, intensity, volume, density, specificity, speed, neuromuscular demand, technical
 * control, tolerance, experience); they are not scientific claims. The templates of each level are
 * built in phase 3 with a specific literature search per profile (docs/SCIENCE_SYSTEM.md §4).
 * Idempotent: global rows are upserted by slug, so wording fixes reach existing deployments.
 */
import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../client';
import { programmingProfiles } from '../schema';

type Level = { name: string; summary: string };
export interface SeedProfile {
  slug: string;
  name: string;
  family:
    | 'rendimiento'
    | 'salud'
    | 'fuerza_hipertrofia'
    | 'readaptacion'
    | 'poblacion_especifica'
    | 'personalizado';
  description: string;
  levels: [string, string, string];
  /** Goal suggested for a new client with this profile (goals.slug). */
  goal: string | null;
  battery: string | null;
  radar: string[];
}

const LEVEL_NAMES = ['Inicial', 'Intermedio', 'Avanzado'] as const;
const PERFORMANCE_RADAR = [
  'fuerza',
  'potencia',
  'velocidad',
  'aceleracion',
  'cod',
  'resistencia',
  'reactividad',
];
const HEALTH_RADAR = [
  'fuerza_funcional',
  'potencia',
  'movilidad',
  'equilibrio',
  'resistencia',
  'capacidad_funcional',
];

export const PROGRAMMING_PROFILES: SeedProfile[] = [
  {
    slug: 'rendimiento-deportivo',
    name: 'Rendimiento deportivo',
    family: 'rendimiento',
    description:
      'Perfil general de rendimiento: relaciona evaluación → cualidades → planificación → reevaluación.',
    levels: [
      'Base de fuerza y técnica de los patrones principales; saltos y carreras de baja intensidad.',
      'Fuerza máxima y potencia con progresión estructurada; pliometría y sprint con volumen controlado.',
      'Alta especificidad y demanda neuromuscular: cargas altas, potencia, velocidad máxima y métodos combinados.',
    ],
    goal: 'general_physical_preparation',
    battery: 'sprint_power',
    radar: PERFORMANCE_RADAR,
  },
  {
    slug: 'deportes-equipo',
    name: 'Deportes de equipo',
    family: 'rendimiento',
    description:
      'Fútbol, balonmano, baloncesto… Fuerza, aceleración, cambio de dirección y resistencia intermitente.',
    levels: [
      'Fuerza general, técnica de aterrizaje y de cambio de dirección; volumen bajo de saltos y sprints.',
      'Fuerza y potencia en semanas de competición; aceleración, deceleración y COD con progresión.',
      'Mantener fuerza y potencia con poca fatiga residual; velocidad máxima y tareas específicas del deporte.',
    ],
    goal: 'team_sport_performance',
    battery: 'team_sport',
    radar: PERFORMANCE_RADAR,
  },
  {
    slug: 'deportes-resistencia',
    name: 'Deportes de resistencia',
    family: 'rendimiento',
    description:
      'Carrera, ciclismo, natación, triatlón: fuerza como complemento del entrenamiento de resistencia.',
    levels: [
      'Fuerza general y técnica, dos días por semana, sin interferir con el entrenamiento principal.',
      'Fuerza máxima y pliometría de bajo volumen; ubicación respecto a las sesiones clave.',
      'Fuerza máxima y explosiva específica, periodizada con las fases de la temporada.',
    ],
    goal: 'endurance_sport_performance',
    battery: 'endurance',
    radar: ['resistencia', 'fuerza', 'potencia', 'reactividad', 'movilidad'],
  },
  {
    slug: 'deportes-individuales',
    name: 'Deportes individuales',
    family: 'rendimiento',
    description:
      'Atletismo, deportes de raqueta, combate…: cualidades según las demandas del deporte.',
    levels: [
      'Base de fuerza, técnica de los patrones y control de aterrizajes.',
      'Fuerza y potencia orientadas a las acciones clave del deporte.',
      'Alta especificidad, potencia y velocidad con periodización por competición.',
    ],
    goal: 'general_physical_preparation',
    battery: 'sprint_power',
    radar: ['fuerza', 'potencia', 'velocidad', 'reactividad', 'resistencia'],
  },
  {
    slug: 'hipertrofia',
    name: 'Hipertrofia',
    family: 'fuerza_hipertrofia',
    description:
      'Aumentar la masa muscular: volumen, proximidad al fallo, frecuencia y recuperación.',
    levels: [
      'Ejercicios básicos y su técnica; volumen moderado, lejos del fallo; progresión de repeticiones.',
      'Más volumen semanal por grupo muscular, más cerca del fallo en ejercicios seguros, división por zonas.',
      'Volumen alto y bien distribuido, técnicas de intensidad seleccionadas, periodización por bloques.',
    ],
    goal: 'hypertrophy',
    battery: 'hypertrophy_strength',
    radar: ['fuerza', 'potencia', 'composicion_corporal'],
  },
  {
    slug: 'fuerza',
    name: 'Fuerza',
    family: 'fuerza_hipertrofia',
    description: 'Fuerza máxima en los patrones principales.',
    levels: [
      'Técnica de los levantamientos básicos con cargas moderadas y progresión lineal.',
      'Cargas altas con autorregulación (RIR/RPE), variantes y progresión ondulante.',
      'Cargas muy altas, picos de fuerza, gestión fina de la fatiga y periodización por bloques.',
    ],
    goal: 'max_strength',
    battery: 'hypertrophy_strength',
    radar: ['fuerza', 'potencia'],
  },
  {
    slug: 'iniciacion-fuerza',
    name: 'Iniciación al entrenamiento de fuerza',
    family: 'fuerza_hipertrofia',
    description:
      'Primer contacto con el entrenamiento de fuerza: aprender, ganar confianza y adherencia.',
    levels: [
      'Máquinas y ejercicios estables, pocas series, mucha técnica y confianza.',
      'Pesos libres básicos y unilaterales, progresión de carga sencilla.',
      'Rutina completa autónoma con progresión de carga y algo de potencia.',
    ],
    goal: 'strength_initiation',
    battery: 'initiation',
    radar: ['fuerza_funcional', 'potencia', 'movilidad', 'capacidad_funcional'],
  },
  {
    slug: 'salud',
    name: 'Salud',
    family: 'salud',
    description: 'Salud general: fuerza, capacidad aeróbica, movilidad y hábitos.',
    levels: [
      'Fuerza general de cuerpo completo y actividad aeróbica suave, con énfasis en la adherencia.',
      'Más carga y variedad; intervalos moderados; equilibrio y movilidad.',
      'Programa completo con fuerza, potencia y resistencia de mayor exigencia.',
    ],
    goal: 'general_health',
    battery: 'health',
    radar: HEALTH_RADAR,
  },
  {
    slug: 'mejora-funcionalidad',
    name: 'Mejora de la funcionalidad',
    family: 'salud',
    description: 'Ganar capacidad para las tareas de la vida diaria y del trabajo.',
    levels: [
      'Patrones básicos (levantarse, cargar, subir escaleras) con poca carga y mucho control.',
      'Patrones con carga, unilaterales y transportes; equilibrio dinámico.',
      'Tareas funcionales complejas, con velocidad y combinación de patrones.',
    ],
    goal: 'functional_strength',
    battery: 'health',
    radar: HEALTH_RADAR,
  },
  {
    slug: 'adulto-mayor',
    name: 'Adulto mayor',
    family: 'poblacion_especifica',
    description:
      'Fuerza, potencia, equilibrio, movilidad, capacidad funcional y autonomía. El nivel se decide por capacidad y evaluación, no solo por la edad.',
    levels: [
      'Fuerza de piernas y tronco con apoyo, levantarse de la silla, equilibrio estático y marcha.',
      'Fuerza con más carga, potencia a velocidad intencional, equilibrio dinámico y transferencias.',
      'Potencia, equilibrio reactivo, tareas duales y programa completo con progresión de carga.',
    ],
    goal: 'functional_strength',
    battery: 'health',
    radar: HEALTH_RADAR,
  },
  {
    slug: 'recuperacion-readaptacion',
    name: 'Recuperación / readaptación',
    family: 'readaptacion',
    description:
      'Entrenamiento tras una lesión, dentro de las restricciones del profesional sanitario. Se programa por fases y criterios del protocolo de la lesión (módulo de readaptación).',
    levels: [
      'Fases iniciales: tolerancia, movilidad y activación sin síntomas.',
      'Fases intermedias: recuperación de fuerza y capacidad de carga.',
      'Fases avanzadas: potencia, carrera y tareas específicas antes de la vuelta al deporte.',
    ],
    goal: 'reconditioning',
    battery: null,
    radar: [],
  },
  {
    slug: 'retorno-deporte',
    name: 'Retorno al deporte',
    family: 'readaptacion',
    description:
      'Vuelta al deporte y al rendimiento tras una lesión. La decisión de vuelta la registra el equipo responsable; la aplicación nunca declara «apto».',
    levels: [
      'Reintroducción de carrera, cambios de dirección y tareas específicas.',
      'Exposición progresiva al entrenamiento con el equipo.',
      'Recuperar el rendimiento previo (return to performance).',
    ],
    goal: 'reconditioning',
    battery: null,
    radar: PERFORMANCE_RADAR,
  },
  {
    slug: 'funcion-muscular',
    name: 'Función muscular',
    family: 'salud',
    description: 'Mejorar la fuerza y la resistencia muscular para la vida diaria.',
    levels: [
      'Ejercicios guiados y estables, pocas series, técnica y sensación de esfuerzo.',
      'Pesos libres, unilaterales y mayor volumen.',
      'Cargas más altas y velocidad intencional en la fase concéntrica.',
    ],
    goal: 'functional_strength',
    battery: 'health',
    radar: ['fuerza_funcional', 'potencia', 'capacidad_funcional'],
  },
  {
    slug: 'funcion-coordinativa',
    name: 'Función coordinativa',
    family: 'salud',
    description: 'Coordinación, equilibrio y control motor.',
    levels: [
      'Tareas simples, estables y lentas, con apoyo cuando haga falta.',
      'Tareas combinadas, unipodales y con cambios de ritmo.',
      'Tareas complejas, rápidas y reactivas, con doble tarea.',
    ],
    goal: 'general_health',
    battery: 'health',
    radar: ['equilibrio', 'coordinacion', 'capacidad_funcional', 'potencia'],
  },
  {
    slug: 'paralisis-cerebral-leve',
    name: 'Parálisis cerebral leve',
    family: 'poblacion_especifica',
    description:
      'Función muscular y coordinativa. Registrar afectación, lado, tono, movilidad, fuerza, coordinación, equilibrio, asimetrías, capacidad funcional y experiencia. El nivel depende de capacidad y evaluación, no del diagnóstico. Coordinar con el equipo sanitario.',
    levels: [
      'Aprender el movimiento: patrones bilaterales con apoyo, lejos del fallo; el lado más afectado marca el ritmo.',
      'Bilateral y unilateral con carga ligera; trabajo específico del lado más afectado.',
      'Mayor carga, potencia y tareas coordinativas complejas según evaluación.',
    ],
    goal: 'functional_strength',
    battery: 'health',
    radar: ['fuerza_funcional', 'potencia', 'equilibrio', 'capacidad_funcional'],
  },
  {
    slug: 'personalizado',
    name: 'Perfil personalizado',
    family: 'personalizado',
    description: 'Para casos que no encajan en los perfiles anteriores: el entrenador lo define.',
    levels: [
      'Nivel 1 definido por el entrenador.',
      'Nivel 2 definido por el entrenador.',
      'Nivel 3 definido por el entrenador.',
    ],
    goal: null,
    battery: null,
    radar: [],
  },
];

export async function seedProgrammingProfiles(db: Database): Promise<number> {
  let order = 0;
  for (const p of PROGRAMMING_PROFILES) {
    order += 10;
    const levels: Record<string, Level> = Object.fromEntries(
      p.levels.map((summary, i) => [String(i + 1), { name: LEVEL_NAMES[i]!, summary }]),
    );
    const values = {
      name: p.name,
      family: p.family,
      description: p.description,
      levels,
      defaultGoalSlug: p.goal,
      defaultBatterySlug: p.battery,
      radarDimensions: p.radar,
      sortOrder: order,
      updatedAt: new Date(),
    };
    const [existing] = await db
      .select({ id: programmingProfiles.id })
      .from(programmingProfiles)
      .where(and(isNull(programmingProfiles.organizationId), eq(programmingProfiles.slug, p.slug)));
    if (existing)
      await db
        .update(programmingProfiles)
        .set(values)
        .where(eq(programmingProfiles.id, existing.id));
    else await db.insert(programmingProfiles).values({ ...values, slug: p.slug });
  }
  return PROGRAMMING_PROFILES.length;
}
