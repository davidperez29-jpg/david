/**
 * Password policy (§14.1): minimum length 12, maximum 128, not a trivially common password,
 * not containing the user's email local part. Breached-password (k-anonymity) checking is an
 * infrastructure concern added in Phase 13.
 */
const COMMON = new Set([
  'password1234',
  '123456789012',
  'qwertyuiopas',
  'contraseña123',
  'contrasena123',
  'administrador',
  'entrenamiento',
  'iloveyou1234',
  'aaaaaaaaaaaa',
]);

export type PasswordProblem = 'too_short' | 'too_long' | 'too_common' | 'contains_email';

export function checkPassword(password: string, email?: string): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  if (password.length < 12) problems.push('too_short');
  if (password.length > 128) problems.push('too_long');
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) problems.push('too_common');
  const local = email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) problems.push('contains_email');
  return problems;
}
