import { readFileSync, writeFileSync } from 'node:fs';
import { PHONE, loadDenyList, normalisePhone } from '../tools/pii-sources.js';

/**
 * Hand-run, never in CI: `tsx scripts/pseudonymise-export.ts <real export.json> <out.json>`.
 * Every person name (in any string, free text included) becomes `Person NN` and every phone number
 * `+9199999NNNNN`. One person gets one number, whichever way the name is written (full name, first name, any case).
 */

const escape = (name: string): string =>
  name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');

export function pseudonymise(
  input: unknown,
  deny: { names: string[]; phones: string[] },
): { value: unknown; people: number } {
  const first = (name: string): string => name.split(' ')[0] as string;
  const keys = [...new Set(deny.names.map(first).filter((key) => key.length >= 3))].sort();
  const number = new Map(keys.map((key, index) => [key, index + 1]));
  const numberOf = (key: string): number => {
    if (!number.has(key)) number.set(key, number.size + 1);
    return number.get(key) as number;
  };
  const words = [...deny.names.map(escape), ...keys.map(escape)].sort(
    (a, b) => b.length - a.length,
  );
  const names = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${words.join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
  const phones = new Map<string, string>();
  const swap = (text: string): string =>
    text
      .replace(names, (hit) => {
        const key = first(hit.toLowerCase().replace(/\s+/g, ' '));
        return `Person ${String(numberOf(key)).padStart(2, '0')}`;
      })
      .replace(PHONE, (hit) => {
        const digits = normalisePhone(hit);
        if (!phones.has(digits))
          phones.set(digits, `+9199999${String(phones.size).padStart(5, '0')}`);
        return phones.get(digits) as string;
      });
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') return swap(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
    }
    return value;
  };
  return { value: walk(input), people: keys.length };
}

if (process.argv[1]?.endsWith('pseudonymise-export.ts')) {
  const [from, to] = process.argv.slice(2);
  if (!from || !to) throw new Error('usage: pseudonymise-export.ts <real export.json> <out.json>');
  const result = pseudonymise(JSON.parse(readFileSync(from, 'utf8')), loadDenyList());
  const output = result.value as { source?: string };
  output.source = 'pseudonymised copy of the 13 November export';
  writeFileSync(to, `${JSON.stringify(result.value)}\n`);
  console.log(`pseudonymised ${result.people} people`);
}
