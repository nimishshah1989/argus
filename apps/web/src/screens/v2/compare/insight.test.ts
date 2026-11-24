// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { CompareReply } from '@uptimo/shared/compare-pair';
import '../../../i18n/index.js';
import { hasYardstick, tilesIn } from '../insight.js';
import { answerKey, realT } from '../printed-page/test-support.js';
import { compareFixture, DEFAULT_PAIR } from './fixture.js';
import { liveCompare } from './live.js';

/**
 * Ticket 674 (ADR 0035): "What is different" opens with a line over the worse machine's hours by cause, the weekly
 * chart with a line over the pair's 12-week hours; the KPIs keep their delta as yardstick. Critical tests only
 * (ADR 0034): figures, never wording. The live pair is `live.test.ts`'s (VC-28: ATC 12 h, LIK 5 h, no code 3 h; 10 h
 * in 12 weeks against VC-22's 1.5 h); the gallery is the fixture's default pair (VC-67: Axis drive 35.2 h of 58.4 h).
 */
type Year = NonNullable<CompareReply['years']>[0];
const year = (over: Partial<Year>): Year => ({
  machineId: 'id',
  code: 'X',
  category: 'Vertical Machining Center',
  cell: 'Cell 1',
  age: 6,
  count: 0,
  hours: 0,
  plannedHours: 5000,
  causes: [],
  weekly: Array.from({ length: 12 }, () => 0),
  last: { count: 0, hours: 0 },
  ...over,
});
const live = liveCompare(
  {
    asOf: '2026-11-11',
    pair: { a: 'VC-28', b: 'VC-22' },
    options: ['VC-28', 'VC-22'],
    figure: answerKey('compare', 'compare', 43).figures[0]!,
    rate: 2000,
    years: [
      year({
        code: 'VC-28',
        count: 8,
        hours: 20,
        causes: [
          { code: 'ATC', count: 4, hours: 12 },
          { code: 'LIK', count: 2, hours: 5 },
          { code: '—', count: 2, hours: 3 },
        ],
        weekly: [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4],
        last: { count: 5, hours: 10 },
      }),
      year({
        code: 'VC-22',
        count: 4,
        hours: 10,
        causes: [
          { code: 'LIK', count: 2, hours: 6 },
          { code: 'ATC', count: 1, hours: 2 },
          { code: 'SPN', count: 1, hours: 2 },
        ],
        weekly: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5],
        last: { count: 4, hours: 8 },
      }),
    ],
  },
  realT,
);
const gallery = compareFixture(DEFAULT_PAIR)!;
const SECTIONS = ['differences', 'trend'];
const has = (text: string | undefined, figures: string[]) => {
  for (const figure of figures) expect(text ?? '').toContain(figure);
};

describe('Compare insight (ticket 674)', () => {
  it('gives both sections a takeaway, live and in the gallery, and every KPI a yardstick', () => {
    for (const model of [live, gallery]) {
      expect(Object.keys(model.takeaways ?? {}).sort()).toEqual(SECTIONS);
      for (const id of SECTIONS) expect(model.takeaways?.[id]?.text.length, id).toBeGreaterThan(0);
      expect(tilesIn(model).filter((tile) => !hasYardstick(tile))).toEqual([]);
    }
  });

  it('names the cause that holds the worse machine’s hours', () => {
    has(live.takeaways?.differences?.text, ['ATC', '3.0', '12.0']);
    has(gallery.takeaways?.differences?.text, ['Axis drive', '6.1', '35.2']);
  });

  it('sets the pair’s 12 weeks against each other', () => {
    has(live.takeaways?.trend?.text, ['VC-28', '6.7', '10.0']);
    has(gallery.takeaways?.trend?.text, ['VC-67', '2.5', '13.2']);
  });
});
