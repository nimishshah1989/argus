/** One thing the search can open: where it goes, what it is called, what kind it is, and the words a typed query is held against. */
export type PaletteEntry = { to: string; text: string; hint: string; match: string };

/** The entries a typed query keeps, in their own order: every entry for a blank query, else those whose words contain it (case ignored). */
export function filterEntries(entries: readonly PaletteEntry[], query: string): PaletteEntry[] {
  const q = query.trim().toLowerCase();
  return q ? entries.filter((entry) => entry.match.toLowerCase().includes(q)) : [...entries];
}
