/**
 * Resolving an old failure code through a plant's `failure_code` list (ticket 47). The list is data, not code:
 * this package holds only the pure map over rows a plant owns — no code is named here (SPEC rule 4). A row's
 * code is canonical; its `aliases` are the old codes folded onto it (Bhavin's ELE on E, HYD on HY, ROT on RT).
 */
export interface FailureCode {
  code: string;
  aliases: readonly string[];
}

/** Every key a plant's list answers to (each code and alias, lower case) and the canonical code it names. */
export interface FailureCodeIndex {
  canonical: ReadonlyMap<string, string>;
}

const key = (value: string): string => value.trim().toLowerCase();

/**
 * The map a close, a settings screen or a figure resolves through. A code wins over an alias when the same text
 * is somehow both (the 0014 trigger refuses that state, so this only decides a torn read). First row wins.
 */
export function failureCodeIndex(rows: readonly FailureCode[]): FailureCodeIndex {
  const canonical = new Map<string, string>();
  for (const row of rows) {
    const code = key(row.code);
    if (code !== '' && !canonical.has(code)) canonical.set(code, row.code);
  }
  for (const row of rows) {
    for (const alias of row.aliases) {
      const name = key(alias);
      if (name !== '' && !canonical.has(name)) canonical.set(name, row.code);
    }
  }
  return { canonical };
}

/**
 * The plant's canonical code for what a client or an old row holds, in any letter case: `ele` → `E`. Null when
 * the plant does not know it, so the caller keeps the raw value (`?? raw`) instead of dropping data.
 */
export function resolveFailureCode(index: FailureCodeIndex, raw: string): string | null {
  const name = key(raw);
  return name === '' ? null : (index.canonical.get(name) ?? null);
}
