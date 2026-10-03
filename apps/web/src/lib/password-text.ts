const TEXT: Record<string, string> = {
  too_short: 'Debe tener al menos 12 caracteres.',
  too_long: 'Máximo 128 caracteres.',
  too_common: 'Es demasiado común o repetitiva.',
  contains_email: 'No debe contener tu email.',
};

export function passwordProblemText(codes: string[] | undefined): string[] | undefined {
  return codes?.map((c) => TEXT[c] ?? c);
}
