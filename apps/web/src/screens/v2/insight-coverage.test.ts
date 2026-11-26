import { describe, expect, it } from 'vitest';
import { FROZEN, PROVIDERS } from './data.js';
import { hasYardstick, tilesIn } from './insight.js';
import type { Takeaways } from '../../ui/v2/takeaway.js';
import { realReply } from './figures/real-reply.js';
import { realT } from './printed-page/test-support.js';
import { shiftKpisModel } from './shift-kpis/adapter.js';
import { boardModel } from './board/adapter.js';
import { fixtureConfig, fixtureState, fixtureToday } from './board/fixture.js';
import { openModel } from './desk/adapter.js';
import { deskFixture } from './desk/fixture.js';
import { answerKey } from './printed-page/test-support.js';
import { monthlyReportModel } from './monthly-report/adapter.js';

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
  'team-focus',
  'why-why',
  'money-matters',
]);

/** Each finished screen's sections, written out so a section added later without a takeaway fails here. */
const SECTIONS: Record<string, string[]> = {
  // ADR 0033: shift-kpis.compare opens with the verdict, not a takeaway that would repeat it.
  'shift-kpis': ['shift-kpis.shift-split', 'shift-kpis.backlog', 'shift-kpis.breakdown-map'],
  // Ticket 772 (S30): the top verdict over the columns and the line over the ages card.
  board: ['board.stops', 'board.ages'],
  // ADR 0045 T3 (S28-A): the desk's Open screen, Breakdowns and Tasks lines (scope desk.md "More intelligent").
  desk: ['desk.breakdowns', 'desk.tasks'],
  // Ticket 767 (S27-A): the report wizard has no table, chart or figure tile, so no takeaway; T2 (#768) adds
  // My complaints' line ("Waiting longest") here when its list joins the floor.
  floor: [],
  'monthly-report': [
    'daily',
    'months',
    'machine',
    'cell',
    'category',
    'code',
    'longest',
    'team',
    'added',
  ],
};

type Said = { text: string }[];
type WithTakeaways = {
  takeaways?: Takeaways;
  verdict?: { headline: Said; why: Said[] };
  sections?: { id: string; notComputed?: true }[];
} | null;
/** A finished screen's model, when its frozen provider needs params or it has none (a test-support file builds it). */
const MODELS: Record<string, () => Promise<WithTakeaways>> = {
  'shift-kpis': async () => shiftKpisModel(realReply(), realT),
  board: async () =>
    boardModel(
      { state: fixtureState, config: fixtureConfig, today: fixtureToday, tv: false },
      realT,
    ),
  desk: async () => openModel(deskFixture, realT),
  'monthly-report': async () =>
    monthlyReportModel(answerKey('monthly-report', 'monthly-report', 42), realT),
};

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
        // ADR 0033: a section the engine did not compute says so once, in its empty state, with no takeaway above it.
        if (model?.sections?.find((s) => s.id === id)?.notComputed) {
          expect(line ?? null, `${key}/${id}: not computed, so no takeaway`).toBeNull();
        } else expect(line?.text.length, `${key}/${id} takeaway`).toBeGreaterThan(0);
      }
      // ADR 0033: no sentence twice; the verdict's headline and its Why lines are the verdict's, a takeaway never repeats one.
      const said = (point: Said) => point.map((seg) => seg.text).join('');
      const verdict = model?.verdict
        ? [model.verdict.headline, ...model.verdict.why].map(said)
        : [];
      const lines = Object.values(model?.takeaways ?? {}).flatMap((line) =>
        line ? [line.text] : [],
      );
      expect(
        lines.filter((text) => verdict.includes(text)),
        `${key}: takeaways the verdict already says`,
      ).toEqual([]);
      // ADR 0026 §4: every figure tile names what it is measured against.
      const bare = tilesIn(model).filter((tile) => !hasYardstick(tile));
      expect(
        bare.map((tile) => tile.id),
        `${key}: tiles without a yardstick`,
      ).toEqual([]);
    });
  }
});
