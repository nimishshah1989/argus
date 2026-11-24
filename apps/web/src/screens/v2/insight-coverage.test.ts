import { describe, expect, it } from 'vitest';
import { FROZEN, PROVIDERS } from './data.js';
import { hasYardstick, tilesIn } from './insight.js';
import type { Takeaways } from '../../ui/v2/takeaway.js';

/**
 * ADR 0023, UX rules 60 and 67: every live v2 screen's model gives each of its sections a computed takeaway, in
 * `model.takeaways` keyed by section id. A screen leaves this list in the ticket that does its insight pass (M2b), and
 * `SECTIONS` then names its section ids. The list only shrinks; a new screen is never added to it.
 */
const NOT_YET = new Set([
  'action-center',
  'age',
  'bd-pm',
  'bottleneck',
  'breakdown-log',
  'category-cell',
  'cell-change-log',
  'compare',
  'dashboard',
  'data-checklist',
  'energy',
  'fix-finder',
  'footprint',
  'forecast-lab',
  'machine',
  'machines-register',
  'manpower',
  'mttr-mtbf',
  'oem',
  'pm-calendar',
  'entity',
  'rows-behind',
  'problem-analysis',
  'shift-kpis',
  'team-focus',
  'why-why',
]);

/** Each finished screen's sections, written out so a section added later without a takeaway fails here. */
const SECTIONS: Record<string, string[]> = {};

type WithTakeaways = { takeaways?: Takeaways } | null;
/** A finished screen's model, when its frozen provider needs params or it has none (a test-support file builds it). */
const MODELS: Record<string, () => Promise<WithTakeaways>> = {};

describe('insight coverage (M2b)', () => {
  it('knows every v2 screen: finished, or on the not-yet list', () => {
    const keys = Object.keys(PROVIDERS).sort();
    const known = [...NOT_YET, ...Object.keys(SECTIONS)].sort();
    expect(
      known.filter((k) => !keys.includes(k)),
      'listed but not a screen',
    ).toEqual([]);
    expect(
      keys.filter((k) => !known.includes(k)),
      'a screen with no decision',
    ).toEqual([]);
  });

  for (const [key, sections] of Object.entries(SECTIONS)) {
    it(`${key}: every section opens with a takeaway`, async () => {
      const provider = (FROZEN[key] ?? PROVIDERS[key]) as (
        params: object,
        ctx: object,
      ) => Promise<WithTakeaways>;
      const model = await (MODELS[key]?.() ?? provider({}, {}));
      expect(Object.keys(model?.takeaways ?? {}).sort()).toEqual([...sections].sort());
      for (const id of sections) {
        const line = model?.takeaways?.[id];
        expect(line?.text.length, `${key}/${id} takeaway`).toBeGreaterThan(0);
      }
      // ADR 0026 §4: every figure tile names what it is measured against.
      const bare = tilesIn(model).filter((tile) => !hasYardstick(tile));
      expect(
        bare.map((tile) => tile.id),
        `${key}: tiles without a yardstick`,
      ).toEqual([]);
    });
  }
});
