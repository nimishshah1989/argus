import type { RedactionTerms } from '../identity/index.js';

/** Text and structure only: no binary or image member (D22 §6). */
export type AiJson = string | number | boolean | null | AiJson[] | { [key: string]: AiJson };

export interface Redactor {
  /** Replaces in every string leaf and returns a new value. */
  redact(value: AiJson): AiJson;
  /** True if any term or phone-shaped number is present. */
  leaks(text: string): boolean;
}

const EDGE_BEFORE = '(?<![\\p{L}\\p{M}\\p{N}])';
const EDGE_AFTER = '(?![\\p{L}\\p{M}\\p{N}])';
const PHONE_SHAPE = '(?<!\\d)\\+?\\d(?:[\\s-]?\\d){9,13}(?!\\d)';

const PHONE_ONLY = new RegExp(`^${PHONE_SHAPE}$`, 'u');
const escape = (term: string): string => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const byLength = (a: string, b: string): number => b.length - a.length;

/** The placeholder map lives only inside this closure: never returned, stored, logged or sent. */
export function createRedactor(terms: RedactionTerms): Redactor {
  const people = [...terms.names, ...terms.shortNames, ...terms.usernames].filter(
    (term) => term.length >= 2,
  );
  const plant = terms.tenantName.toLowerCase();
  const phones = new Set(terms.phones);
  const literals = [...new Set([...people, ...terms.phones, terms.tenantName])]
    .filter(Boolean)
    .sort(byLength);
  const flags = (extra: string): string => `${extra}iu`;
  const termSource = literals.length
    ? `${EDGE_BEFORE}(?:${literals.map(escape).join('|')})${EDGE_AFTER}`
    : null;
  const sources = [termSource, PHONE_SHAPE].filter((s): s is string => s !== null);
  const pattern = sources.join('|');
  const placeholders = new Map<string, string>();

  function placeholder(match: string): string {
    const key = match.toLowerCase();
    if (key === plant) return '[PLANT]';
    if (phones.has(match) || PHONE_ONLY.test(match)) return '[PHONE]';
    let found = placeholders.get(key);
    if (!found) {
      found = `[P${placeholders.size + 1}]`;
      placeholders.set(key, found);
    }
    return found;
  }

  function redact(value: AiJson): AiJson {
    if (typeof value === 'string')
      return value.replace(new RegExp(pattern, flags('g')), placeholder);
    if (Array.isArray(value)) return value.map(redact);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v)]));
    }
    return value;
  }

  return { redact, leaks: (text) => new RegExp(pattern, flags('')).test(text) };
}
