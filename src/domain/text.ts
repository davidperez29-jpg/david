/** Normaliza un texto para búsquedas: sin tildes, en minúsculas y sin espacios sobrantes. */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesSearch(haystack: readonly string[], query: string): boolean {
  const needle = normalizeForSearch(query);
  if (needle === '') return true;
  return haystack.some((value) => normalizeForSearch(value).includes(needle));
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]![0], words.at(-1)![0]] : [words[0]?.[0]];
  return letters.filter(Boolean).join('').toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}
