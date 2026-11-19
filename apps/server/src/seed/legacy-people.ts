import { createHash } from 'node:crypto';
import { normalizeKey, SUBMITTER_FALLBACK } from './breakdown-log-export.js';

/**
 * Legacy workbooks, people: no name leaves the converter. A person in DONE BY becomes a code (R8): the tenant's
 * `personCode` on an exact normalised match, else `LG-` plus 8 hex of the name's sha256, the same in every year.
 * Role words drop, team spellings fold to one team, and names inside the free text become `[person]` (R10).
 */
export interface PlantPerson {
  name: string;
  code: string;
}

const ROLE_WORD = /^(operator|opeartor|opeator|setter|supervisor|engineer)$/i;
const TEAM_WORD = /^(main\w*[. ]*team|team|maint\w*\.?)$/i;
/** Words that look like name parts but are plant vocabulary: never redacted, never a leak. */
const PLANT_WORDS = new Set(
  ['and', 'the', 'team', 'maint', 'main', 'mech', 'elec', 'for', 'with'].concat(
    // Ordinary two-letter words must stay readable in free text even when a name part is this short.
    [
      'is',
      'at',
      'to',
      'of',
      'on',
      'in',
      'as',
      'by',
      'or',
      'no',
      'if',
      'it',
      'be',
      'we',
      'an',
      'up',
    ],
    ['do', 'so', 'he', 'me', 'my', 'mr', 'ms', 'dr', 'ok', 'nc', 'pm', 'ac', 'dc'],
  ),
);
const isPhone = (run: string): boolean => {
  const digits = run.replace(/\D/g, '').length;
  return digits >= 9 && digits <= 15;
};
const PHONE = /(?<!\d)\+?\(?\d[\d\s().-]{7,}\d(?!\d)/g;

export const splitNames = (cell: string): string[] =>
  cell
    .split(/[,/&+\n]|\sand\s/i)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const wordsOf = (name: string): string[] =>
  (name.match(/\p{L}{2,}/gu) ?? []).filter((word) => !PLANT_WORDS.has(word.toLowerCase()));

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      const swap = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + swap);
    }
    row = next;
  }
  return row[b.length] ?? 2;
}

export interface People {
  /** Codes for a DONE BY cell: roles dropped, teams folded, each person once. */
  codesOf(cell: string): string[];
  /** Free text with names and phone numbers replaced. */
  redact(text: string): string;
  /** How many of the names seen sit one letter from another: a typo that minted its own code. */
  possibleDuplicates(used: ReadonlySet<string>): number;
  /** The name words still present in a text: the proof the output holds none. */
  leaks(text: string): number;
  /** Phone-shaped runs still present in a free text. */
  phoneLeaks(text: string): number;
}

export function createPeople(
  tenant: readonly PlantPerson[],
  terms: readonly string[],
  nameCells: Iterable<string>,
): People {
  const byName = new Map(tenant.map((person) => [normalizeKey(person.name), person.code]));
  const words = new Set<string>();
  for (const cell of [...nameCells, ...tenant.map((p) => p.name), ...terms]) {
    for (const name of splitNames(cell)) {
      if (!ROLE_WORD.test(name) && !TEAM_WORD.test(name))
        wordsOf(name).forEach((w) => words.add(w));
    }
  }
  const pattern = [...words].sort((a, b) => b.length - a.length || (a < b ? -1 : 1)).join('|');
  const wordRe = pattern
    ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'giu')
    : null;
  const minted = new Map<string, string>(); // code -> normalised name
  const codeOf = (name: string): string | null => {
    if (ROLE_WORD.test(name)) return null;
    if (TEAM_WORD.test(name)) return SUBMITTER_FALLBACK;
    const key = normalizeKey(name);
    const known = byName.get(key);
    if (known) return known;
    const code = `LG-${createHash('sha256').update(key).digest('hex').slice(0, 8)}`;
    minted.set(code, key);
    return code;
  };
  return {
    codesOf: (cell) => [
      ...new Set(
        splitNames(cell)
          .map(codeOf)
          .filter((c): c is string => c !== null),
      ),
    ],
    redact: (text) =>
      (wordRe ? text.replace(wordRe, '[person]') : text).replace(PHONE, (run) =>
        isPhone(run) ? '[phone]' : run,
      ),
    possibleDuplicates: (used) => {
      const names = [...minted]
        .filter(([code, name]) => used.has(code) && name.length >= 5)
        .map(([, name]) => name)
        .sort();
      let count = 0;
      for (let i = 0; i < names.length; i++) {
        count += names.slice(i + 1).some((other) => distance(names[i] ?? '', other) <= 1) ? 1 : 0;
      }
      return count;
    },
    phoneLeaks: (text) => (text.match(PHONE) ?? []).filter(isPhone).length,
    leaks: (text) => (wordRe ? (text.match(wordRe) ?? []).length : 0),
  };
}
