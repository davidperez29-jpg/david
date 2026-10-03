/** Age in whole years at a reference date. Age is never stored, always derived (§6.4). */
export function ageAt(birthDate: string | Date, at: Date = new Date()): number {
  const b = typeof birthDate === 'string' ? new Date(`${birthDate}T00:00:00Z`) : birthDate;
  let age = at.getUTCFullYear() - b.getUTCFullYear();
  const m = at.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < b.getUTCDate())) age--;
  return age;
}
