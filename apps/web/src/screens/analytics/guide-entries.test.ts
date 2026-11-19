import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIGURE_KEYS } from '@uptimo/domain';
import { en } from '@uptimo/shared/i18n';
import { groupOfScreen } from './groups.js';
import { GUIDE_ENTRIES, NOT_BUILT, guideFigureLinks } from './guide-entries.js';

/**
 * The Guide is the answer key's 36 headings and the registry's figures, held together so neither side can drift.
 * The headings come from `fixtures/answer-key/guide.json` `extra`, never hand-copied; every registered figure is
 * explained exactly once, and every figure's link names the group that really holds its screen.
 */

interface GuideKey {
  extra: string[];
}

const GUIDE = JSON.parse(
  readFileSync(new URL('../../../../../fixtures/answer-key/guide.json', import.meta.url), 'utf8'),
) as GuideKey;

/** The catalogue key whose English value is the heading, so the key's own words select the key's own copy. */
function keyOf(heading: string): keyof typeof en {
  const key = (Object.keys(en) as (keyof typeof en)[]).find(
    (candidate) => en[candidate] === heading,
  );
  if (key === undefined) throw new Error(`the catalogue names no entry for: ${heading}`);
  return key;
}

/** The four headings this build does not have yet, in the key's order. */
const UNBUILT = [
  '32. OEM Analytics',
  '33. Learning from your corrections',
  '34. Entries with no maintenance code',
  '35. AMC, extended warranty and legal compliance (per machine)',
];

describe('the Guide follows the answer key', () => {
  it('lists the key’s 36 headings, in order, through the en catalogue', () => {
    expect(GUIDE.extra).toHaveLength(36);
    expect(GUIDE_ENTRIES.map((entry) => entry.titleKey)).toEqual(GUIDE.extra.map(keyOf));
  });

  it('gives every entry at least one body paragraph, and keeps the four unbuilt entries to the not-built line', () => {
    for (const entry of GUIDE_ENTRIES) {
      expect(entry.bodyKeys.length, entry.id).toBeGreaterThan(0);
      for (const key of entry.bodyKeys) expect(en[key], `${entry.id}: ${key}`).toBeTruthy();
      if (entry.formulaKey !== undefined) expect(en[entry.formulaKey], entry.id).toBeTruthy();
      const unbuilt = entry.bodyKeys.length === 1 && entry.bodyKeys[0] === NOT_BUILT;
      expect(unbuilt, entry.id).toBe(entry.built === false);
    }
    expect(
      GUIDE_ENTRIES.filter((entry) => entry.built === false).map((entry) => en[entry.titleKey]),
    ).toEqual(UNBUILT);
    expect(en[NOT_BUILT]).toBeTruthy();
  });
});

describe('every registered figure is explained exactly once', () => {
  it('names every figure once and no figure the registry does not have', () => {
    const seen = new Map<string, number>();
    for (const entry of GUIDE_ENTRIES)
      for (const key of entry.figures) seen.set(key, (seen.get(key) ?? 0) + 1);
    expect([...seen.keys()].sort()).toEqual([...FIGURE_KEYS].sort());
    for (const key of FIGURE_KEYS) expect(seen.get(key), key).toBe(1);
  });

  it('links every figure to the group that really holds its screen', () => {
    for (const entry of GUIDE_ENTRIES)
      for (const link of guideFigureLinks(entry)) {
        const group = groupOfScreen(link.screen);
        expect(group, link.screen).not.toBeNull();
        expect(link.href, link.screen).toBe(`/analytics/${group!.id}?screen=${link.screen}`);
      }
  });
});
