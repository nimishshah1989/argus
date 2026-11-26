// @vitest-environment node
import { en } from '@uptimo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { fill } from '../../../../i18n/fill.js';
import { printed } from '../../figures/real-reply.js';
import type { Translate } from '../../figures/read.js';
import { causeCell, oemModel } from '../adapter.js';
import { causeReply } from '../cause-fixture.js';

const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});

describe('S18 cause picker: edges', () => {
  it('a reader who may not decide gets no action in any row of any table', () => {
    const model = oemModel(causeReply(), t, { mayDecide: false })!;
    for (const table of model.tables)
      for (const row of table.rows)
        for (const cell of row) expect(cell.action, table.title).toBeUndefined();
  });

  it('an empty ticket id is no ticket', () => {
    expect(causeCell('Not decided', '', true).action).toBeUndefined();
  });

  it('no rupee on the page, and no "suggested" cause', () => {
    for (const mayDecide of [true, false]) {
      const shown = printed(oemModel(causeReply(), t, { mayDecide })).join(' ');
      expect(shown).not.toMatch(/₹|Suggested/i);
    }
  });

  it('only actions of the cause:<ticket> form, one per row with a ticket', () => {
    const model = oemModel(causeReply(), t, { mayDecide: true })!;
    const actions = model.tables
      .flatMap((table) => table.rows.flat())
      .flatMap((cell) => cell.action ?? []);
    expect(actions.every((a) => /^cause:ticket-\d+$/.test(a))).toBe(true);
    expect(new Set(actions).size).toBe(actions.length);
    expect(actions).toHaveLength(71);
  });
});
