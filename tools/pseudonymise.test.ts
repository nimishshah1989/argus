import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pseudonymise } from '../scripts/pseudonymise-export.js';
import { PHONE, loadDenyList } from './pii-sources.js';

const COPY = 'apps/server/test/fixtures/bhavin-export.pseudonymised.json';

describe('the pseudonymised copy of Bhavin export', () => {
  const deny = loadDenyList();
  const text = readFileSync(COPY, 'utf8');

  it('holds no person name, not even a first name in free text', () => {
    const firstNames = new Set(deny.names.map((name) => name.split(' ')[0] as string));
    for (const first of firstNames) {
      if (first.length < 3) continue;
      expect(text, first).not.toMatch(
        new RegExp(`(?<![\\p{L}\\p{N}_])${first}(?![\\p{L}\\p{N}_])`, 'iu'),
      );
    }
  });

  it('holds no phone number from the source lists', () => {
    expect([...text.matchAll(PHONE)].length).toBe(0);
  });

  it('gives one person one number however the name is written', () => {
    const out = pseudonymise(
      { a: 'jane doe (Maintenance)', b: 'Jane said call 98250 12345 now', c: 'Operator' },
      { names: ['jane doe'], phones: [] },
    ).value as Record<string, string>;
    expect(out.a).toBe('Person 01 (Maintenance)');
    expect(out.b).toBe('Person 01 said call +919999900000 now');
    expect(out.c).toBe('Operator');
  });
});
