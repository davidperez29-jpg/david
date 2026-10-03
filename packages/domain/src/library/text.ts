/** Accent/case-insensitive key used to detect duplicate exercise names. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function slugify(name: string, maxLength = 80): string {
  return normalizeName(name).replace(/ /g, '-').slice(0, maxLength).replace(/-+$/, '') || 'item';
}
