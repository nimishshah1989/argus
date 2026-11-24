import { describe, expect, it } from 'vitest';
import i18n from 'i18next';
import type { ActionCenterBoardReply } from '@uptimo/shared';
import '../../../i18n/index.js';
import { hasYardstick, tilesIn } from '../insight.js';
import { actionCenterModel } from './adapter.js';
import recorded from './frozen-board.json' with { type: 'json' };
import { frozenActionCenter } from './frozen.js';

/**
 * Ticket 654 (ADR 0035): the nudges table opens with the kit line over the open nudges by kind, the risk table with the
 * kit's outlier over the scores, and each priority card names its share of the open nudges. Critical tests only
 * (ADR 0034): figures, not wording or tone. Frozen 11 Nov board: 33 open nudges over 8 kinds.
 */
const t = (key: string, values?: Record<string, unknown>) => i18n.t(key, { ...values }) as string;

/** Card id → the figures its yardstick must carry. */
const YARDSTICKS: Record<string, string[]> = {
  high: ['15%', '33'],
  med: ['79%', '33'],
  low: ['6%', '33'],
  info: ['0%', '33'],
};

describe('Action Center insight (ticket 654)', () => {
  it('gives both tables a takeaway', async () => {
    const model = await frozenActionCenter();
    expect(Object.keys(model.takeaways ?? {}).sort()).toEqual(['nudges', 'risk']);
    for (const id of ['nudges', 'risk'])
      expect(model.takeaways?.[id]?.text.length, id).toBeGreaterThan(0);
  });

  it('says how few kinds hold most of the open nudges, and which machine scores far above the rest', async () => {
    const model = await frozenActionCenter();
    for (const figure of ['2', '8', '58%'])
      expect(model.takeaways?.nudges?.text ?? '').toContain(figure);
    for (const figure of ['HMC-2', '2.0', '7'])
      expect(model.takeaways?.risk?.text ?? '').toContain(figure);
  });

  it('counts only open nudges: an acknowledged, snoozed or resolved kind drops out', () => {
    const board = structuredClone(recorded) as unknown as ActionCenterBoardReply;
    for (const nudge of board.nudges) if (nudge.rule === 'freq') nudge.status = 'resolved';
    const machines = [...new Set(board.nudges.flatMap((n) => n.machines))].map((code) => ({
      id: code,
      code,
      category: null,
    }));
    const model = actionCenterModel({ board, machines, people: [], timeZone: 'Asia/Kolkata' }, t);
    // Open without "Frequent breakdowns": 20 nudges over 7 kinds; Slow repairs 6 + Worsening machine 5 = 55%.
    for (const figure of ['2', '7', '55%'])
      expect(model.takeaways?.nudges?.text ?? '').toContain(figure);
  });

  it('gives every priority card its share of the open nudges', async () => {
    const model = await frozenActionCenter();
    expect(tilesIn(model).filter((tile) => !hasYardstick(tile))).toEqual([]);
    for (const [id, figures] of Object.entries(YARDSTICKS)) {
      const card = model.kpis.find((kpi) => kpi.id === id);
      for (const figure of figures) expect(card?.yardstick ?? '', id).toContain(figure);
    }
  });
});
