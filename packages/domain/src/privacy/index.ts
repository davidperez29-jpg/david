/**
 * Data-subject rights and retention (Phase 13, RGPD arts. 12–21). Pure helpers; the legal choices
 * (retention period) belong to the controller and are marked [REQUIERE VALIDACIÓN LEGAL].
 */
export const PRIVACY_RIGHTS = {
  access: {
    name: 'Acceso',
    text: 'Saber qué datos tuyos tratamos y obtener una copia.',
  },
  portability: {
    name: 'Portabilidad',
    text: 'Recibir tus datos en un formato estructurado (JSON) para llevarlos a otro servicio.',
  },
  rectification: {
    name: 'Rectificación',
    text: 'Corregir datos inexactos o incompletos.',
  },
  erasure: {
    name: 'Supresión',
    text: 'Que se borren o anonimicen tus datos personales cuando ya no sean necesarios.',
  },
  restriction: {
    name: 'Limitación',
    text: 'Que se conserven tus datos pero sin usarlos mientras se resuelve una reclamación.',
  },
  objection: {
    name: 'Oposición',
    text: 'Oponerte a un tratamiento concreto de tus datos.',
  },
} as const;
export type PrivacyRight = keyof typeof PRIVACY_RIGHTS;

/** One month to answer (art. 12.3): same day of the next month, or its last day. */
export function privacyDueOn(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number) as [number, number, number];
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Archived long enough for automatic anonymization (null months = the controller has not decided). */
export function retentionExpired(
  archivedAt: Date | null,
  retentionMonths: number | null,
  now: Date,
): boolean {
  if (!archivedAt || retentionMonths == null) return false;
  const limit = new Date(archivedAt);
  limit.setUTCMonth(limit.getUTCMonth() + retentionMonths);
  return limit <= now;
}

/**
 * Replacement values for an erased client. Only the birth year survives (age bands in anonymous
 * aggregates); training data stay linked to the pseudonymous id, without any identifier.
 */
export function anonymizedClientFields(clientId: string, birthDate: string | null) {
  return {
    firstName: 'Cliente',
    lastName: `anónimo ${clientId.slice(-6)}`,
    birthDate: birthDate ? `${birthDate.slice(0, 4)}-01-01` : null,
    email: null,
    phoneEnc: null,
    preferences: null,
  };
}
