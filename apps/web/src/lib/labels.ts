/** Spanish labels for enum values shown in the UI. */
export const LABELS = {
  sex: { female: 'Mujer', male: 'Hombre', other: 'Otro', undisclosed: 'Prefiere no indicarlo' },
  status: { lead: 'Potencial', active: 'Activo', paused: 'En pausa', archived: 'Archivado' },
  modality: { in_person: 'Presencial', online: 'Online', hybrid: 'Híbrido' },
  experience: {
    none: 'Sin experiencia',
    beginner: 'Principiante',
    intermediate: 'Intermedio',
    advanced: 'Avanzado',
  },
  location: {
    gym: 'Gimnasio',
    home: 'Casa',
    outdoor: 'Aire libre',
    studio: 'Estudio',
    mixed: 'Mixto',
  },
  competitiveLevel: {
    recreational: 'Recreativo',
    amateur: 'Amateur',
    semi_professional: 'Semiprofesional',
    professional: 'Profesional',
    elite: 'Élite',
  },
  healthType: {
    injury: 'Lesión declarada',
    surgery: 'Cirugía declarada',
    limitation: 'Limitación',
    other: 'Otra',
  },
  declaredStatus: { active: 'Activa', resolved: 'Resuelta', unknown: 'Desconocido' },
  consentPurpose: {
    service_terms: 'Condiciones del servicio',
    health_data: 'Datos de salud (art. 9 RGPD)',
    photo: 'Fotografías',
    marketing: 'Comunicaciones comerciales',
  },
  consentMethod: { in_app: 'En la app', paper: 'En papel', verbal_recorded: 'Verbal registrado' },
  role: { ADMIN: 'Administración', TRAINER: 'Entrenador/a', CLIENT: 'Cliente' },
  equipmentLocation: { home: 'Casa', gym: 'Gimnasio', both: 'Ambos' },
  historyKind: { sport: 'Deportivo', training: 'Entrenamiento' },
  assignmentRole: { primary: 'Principal', collaborator: 'Colaborador/a' },
  audit: {
    create: 'Creación',
    update: 'Modificación',
    archive: 'Archivado',
    restore: 'Restaurado',
    delete: 'Eliminación',
    view_sensitive: 'Consulta de datos de salud',
    grant: 'Consentimiento otorgado',
    revoke: 'Consentimiento revocado',
    assign: 'Asignación',
    unassign: 'Fin de asignación',
    clear: 'Valoración sanitaria registrada',
    invite: 'Invitación',
    invitation_accepted: 'Invitación aceptada',
  },
  entity: {
    client: 'Cliente',
    client_training_profile: 'Perfil de entrenamiento',
    client_goals: 'Objetivos',
    client_availability: 'Disponibilidad',
    client_equipment: 'Material',
    client_history_entry: 'Historial',
    health_declaration: 'Declaración de salud',
    health_declarations: 'Datos de salud',
    screening: 'Cribado',
    consent: 'Consentimiento',
    trainer_client_assignment: 'Asignación de entrenador',
    invitation: 'Invitación',
  },
  field: {
    firstName: 'Nombre',
    lastName: 'Apellidos',
    birthDate: 'Fecha de nacimiento',
    sex: 'Sexo',
    email: 'Email',
    phone: 'Teléfono',
    modality: 'Modalidad',
    status: 'Estado',
    preferences: 'Preferencias',
    experienceLevel: 'Experiencia',
    yearsTraining: 'Años entrenando',
    sessionsPerWeek: 'Sesiones/semana',
    sessionDurationMin: 'Duración (min)',
    location: 'Lugar',
    notes: 'Notas',
    goals: 'Objetivos',
  },
  weekday: ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
} as const;

export function label<K extends keyof typeof LABELS>(
  group: K,
  value: string | null | undefined,
): string {
  if (value == null) return '—';
  const g = LABELS[group] as unknown as Record<string, string>;
  return g[value] ?? value;
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : d;
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone:
      d instanceof Date || (typeof d === 'string' && d.length > 10) ? 'Europe/Madrid' : 'UTC',
  }).format(date);
}

export function formatDateTime(d: string | Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(d));
}
