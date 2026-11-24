import { describe, expect, it } from 'vitest';
import i18n from 'i18next';
import type { ActionCenterBoardReply } from '@uptimo/shared';
import '../../../i18n/index.js';
import { actionCenterModel } from '../action-center/adapter.js';
import recorded from '../action-center/frozen-board.json' with { type: 'json' };

const t = (key: string, values?: Record<string, unknown>) => i18n.t(key, { ...values }) as string;

describe('Action Center insight: nothing open (ticket 654, hidden)', () => {
  it('invents no share and no count when no nudge is open', () => {
    const board = structuredClone(recorded) as unknown as ActionCenterBoardReply;
    for (const nudge of board.nudges) nudge.status = 'resolved';
    board.counts = { ...board.counts, open: 0 };
    board.bySeverity = { high: 0, med: 0, low: 0, info: 0 };
    const model = actionCenterModel(
      { board, machines: [], people: [], timeZone: 'Asia/Kolkata' },
      t,
    );
    expect(model.takeaways?.nudges?.text ?? '').not.toMatch(/\d/);
    for (const card of model.kpis) expect(card.yardstick ?? '', card.id).not.toMatch(/\d/);
  });
});
