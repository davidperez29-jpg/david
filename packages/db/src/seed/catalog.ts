import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from '@tp/domain';
import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../client';
import { equipment, goals, permissions, rolePermissions, roles, sports } from '../schema';

const ROLE_NAMES = { ADMIN: 'Administración', TRAINER: 'Entrenador/a', CLIENT: 'Cliente' } as const;

/** Objetivos del sistema (§2.2). Catálogo global, editable/ampliable por organización. */
export const GLOBAL_GOALS = [
  ['hypertrophy', 'Hipertrofia', 'muscle'],
  ['strength_initiation', 'Iniciación a la fuerza', 'strength'],
  ['general_health', 'Salud general', 'health'],
  ['functional_strength', 'Fuerza funcional', 'strength'],
  ['max_strength', 'Fuerza máxima', 'strength'],
  ['power', 'Potencia', 'power_speed'],
  ['team_sport_performance', 'Rendimiento en deportes de equipo', 'sport_performance'],
  ['endurance_sport_performance', 'Rendimiento en deportes de resistencia', 'endurance'],
  ['sprint', 'Sprint', 'power_speed'],
  ['acceleration', 'Aceleración', 'power_speed'],
  ['change_of_direction', 'Cambio de dirección', 'power_speed'],
  ['agility', 'Agilidad', 'power_speed'],
  ['body_composition', 'Composición corporal', 'body_composition'],
  ['mobility', 'Movilidad', 'mobility'],
  ['neuromuscular_capacity', 'Capacidad neuromuscular', 'power_speed'],
  ['reconditioning', 'Reacondicionamiento', 'reconditioning'],
  ['general_physical_preparation', 'Preparación física general', 'general'],
] as const;

const GOAL_DESCRIPTIONS: Partial<Record<(typeof GLOBAL_GOALS)[number][0], string>> = {
  reconditioning:
    'Vuelta progresiva al entrenamiento tras inactividad o tras el alta de un profesional sanitario. No es rehabilitación clínica.',
};

export const GLOBAL_SPORTS = [
  ['football', 'Fútbol', 'team'],
  ['handball', 'Balonmano', 'team'],
  ['basketball', 'Baloncesto', 'team'],
  ['volleyball', 'Voleibol', 'team'],
  ['rugby', 'Rugby', 'team'],
  ['field_hockey', 'Hockey', 'team'],
  ['futsal', 'Fútbol sala', 'team'],
  ['sprint_athletics', 'Atletismo (velocidad)', 'individual'],
  ['distance_running', 'Carrera de fondo', 'endurance'],
  ['cycling', 'Ciclismo', 'endurance'],
  ['swimming', 'Natación', 'endurance'],
  ['triathlon', 'Triatlón', 'endurance'],
  ['tennis', 'Tenis', 'racket'],
  ['padel', 'Pádel', 'racket'],
  ['combat_sports', 'Deportes de combate', 'combat'],
  ['other', 'Otro', 'other'],
] as const;

export const GLOBAL_EQUIPMENT = [
  ['barbell', 'Barra olímpica', 'free_weights'],
  ['plates', 'Discos', 'free_weights'],
  ['squat_rack', 'Rack / jaula', 'free_weights'],
  ['bench', 'Banco plano/inclinable', 'free_weights'],
  ['dumbbells', 'Mancuernas', 'free_weights'],
  ['kettlebells', 'Kettlebells', 'free_weights'],
  ['landmine', 'Landmine', 'free_weights'],
  ['cable_station', 'Poleas', 'machines'],
  ['leg_press', 'Prensa de piernas', 'machines'],
  ['machines_other', 'Otras máquinas guiadas', 'machines'],
  ['pull_up_bar', 'Barra de dominadas', 'bodyweight'],
  ['suspension_trainer', 'Entrenador en suspensión', 'bodyweight'],
  ['resistance_bands', 'Bandas elásticas', 'accommodating'],
  ['chains', 'Cadenas', 'accommodating'],
  ['plyo_box', 'Cajón pliométrico', 'plyometrics'],
  ['step', 'Step', 'plyometrics'],
  ['medicine_ball', 'Balón medicinal', 'plyometrics'],
  ['sled', 'Trineo', 'speed'],
  ['cones', 'Conos / marcas', 'speed'],
  ['flywheel', 'Polea cónica / flywheel', 'eccentric'],
  ['treadmill', 'Cinta de correr', 'cardio'],
  ['bike_erg', 'Bicicleta estática / ergómetro', 'cardio'],
  ['rower', 'Remoergómetro', 'cardio'],
  ['mat', 'Esterilla', 'mobility'],
  ['foam_roller', 'Rodillo de espuma', 'mobility'],
  ['linear_encoder', 'Encoder lineal / dispositivo VBT', 'measurement'],
  ['jump_mat_or_app', 'Plataforma de contacto o app de salto', 'measurement'],
  ['timing_gates', 'Células fotoeléctricas', 'measurement'],
  ['force_plate', 'Plataforma de fuerza', 'measurement'],
  ['handgrip_dynamometer', 'Dinamómetro de prensión', 'measurement'],
] as const;

/** Idempotent: safe to run on every deploy. */
export async function seedCatalog(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    for (const key of ROLES) {
      await tx.insert(roles).values({ key, name: ROLE_NAMES[key] }).onConflictDoNothing();
    }
    for (const key of PERMISSIONS) {
      await tx.insert(permissions).values({ key }).onConflictDoNothing();
    }
    const roleRows = await tx.select().from(roles);
    const permRows = await tx.select().from(permissions);
    for (const r of roleRows) {
      for (const [perm, scope] of Object.entries(ROLE_PERMISSIONS[r.key])) {
        const p = permRows.find((x) => x.key === perm);
        if (!p || !scope) continue;
        await tx
          .insert(rolePermissions)
          .values({ roleId: r.id, permissionId: p.id, scope })
          .onConflictDoUpdate({
            target: [rolePermissions.roleId, rolePermissions.permissionId],
            set: { scope },
          });
      }
    }
    let order = 0;
    for (const [slug, name, family] of GLOBAL_GOALS) {
      order += 10;
      const existing = await tx
        .select({ id: goals.id })
        .from(goals)
        .where(and(isNull(goals.organizationId), eq(goals.slug, slug)));
      if (existing.length === 0) {
        await tx.insert(goals).values({
          slug,
          name,
          family,
          sortOrder: order,
          description: GOAL_DESCRIPTIONS[slug] ?? null,
        });
      }
    }
    for (const [slug, name, family] of GLOBAL_SPORTS) {
      const existing = await tx
        .select({ id: sports.id })
        .from(sports)
        .where(and(isNull(sports.organizationId), eq(sports.slug, slug)));
      if (existing.length === 0) await tx.insert(sports).values({ slug, name, family });
    }
    for (const [slug, name, category] of GLOBAL_EQUIPMENT) {
      const existing = await tx
        .select({ id: equipment.id })
        .from(equipment)
        .where(and(isNull(equipment.organizationId), eq(equipment.slug, slug)));
      if (existing.length === 0) await tx.insert(equipment).values({ slug, name, category });
    }
  });
}
