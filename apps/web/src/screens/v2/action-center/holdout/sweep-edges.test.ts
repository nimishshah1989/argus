// @vitest-environment node
import i18n from 'i18next';
import { describe, expect, it } from 'vitest';
import type { ActionCenterBoardReply } from '@uptimo/shared';
import '../../../../i18n/index.js';
import { actionCenterModel } from '../adapter.js';
import { actionCenterSheets, riskReasons } from '../sweep.js';
import { PEOPLE, recordedBoard } from '../test-board.js';

/** The edges of the Action Center's sweep helpers (#706 batch A). */
const t = (key: string, values?: Record<string, string | number>) =>
  i18n.t(key, { ...values }) as string;
const LABELS = ['Long breakdown', 'Slow repairs', 'Recurring fault', 'Frequent breakdowns'];

describe('riskReasons edges', () => {
  it('nothing, or only spaces, is no reason', () => {
    expect(riskReasons('', LABELS)).toEqual([]);
    expect(riskReasons('   ', LABELS)).toEqual([]);
  });

  it('accepts the × sign as well as x, and only a count of digits', () => {
    expect(riskReasons('Slow repairs ×4', LABELS)).toEqual([{ text: 'Slow repairs', n: 4 }]);
    expect(riskReasons('Slow repairs x12 Long breakdown x2', LABELS)).toEqual([
      { text: 'Slow repairs', n: 12 },
      { text: 'Long breakdown', n: 2 },
    ]);
  });

  it('leaves n out entirely when there is no count', () => {
    const [only] = riskReasons('Recurring fault', LABELS);
    expect(only).toEqual({ text: 'Recurring fault' });
    expect(Object.hasOwn(only!, 'n')).toBe(false);
  });

  it('keeps plain text it cannot match as one reason, never dropped or split', () => {
    expect(riskReasons('Repeat on night shift', LABELS)).toEqual([
      { text: 'Repeat on night shift' },
    ]);
    expect(riskReasons('Slow repairs x2 Something new here', LABELS)).toEqual([
      { text: 'Slow repairs', n: 2 },
      { text: 'Something new here' },
    ]);
    expect(riskReasons('Anything', [])).toEqual([{ text: 'Anything' }]);
  });

  it('takes the longest label, and only a whole one', () => {
    const labels = ['Long', 'Long breakdown'];
    expect(riskReasons('Long breakdown x2 Long', labels)).toEqual([
      { text: 'Long breakdown', n: 2 },
      { text: 'Long' },
    ]);
    expect(riskReasons('Long breakdowns', ['Long breakdown'])).toEqual([
      { text: 'Long breakdowns' },
    ]);
  });

  it('trims the ends', () => {
    expect(riskReasons('  Slow repairs  ', LABELS)).toEqual([{ text: 'Slow repairs' }]);
  });
});

describe('actionCenterSheets edges', () => {
  const board = recordedBoard();
  const facts = (b: ActionCenterBoardReply) => ({
    board: b,
    machines: [...new Set(b.nudges.flatMap((n) => n.machines))].map((code) => ({
      id: code,
      code,
      category: null,
    })),
    people: PEOPLE,
    timeZone: 'Asia/Kolkata',
  });

  it('an empty board still gives both sheets, header rows only', () => {
    const empty = actionCenterModel(
      facts({
        ...board,
        nudges: [],
        risk: [],
        counts: { open: 0, ack: 0, snoozed: 0, resolved: 0 },
      }),
      t,
    );
    const sheets = actionCenterSheets(empty);
    expect(sheets).toHaveLength(2);
    expect(sheets.map((s) => s.rows.length)).toEqual([1, 1]);
  });

  it('a stored nudge carries its due day and note after its status; an open one only its status', () => {
    const model = actionCenterModel(facts(board), t);
    const rows = actionCenterSheets(model)[0]!.rows.slice(1);
    model.nudges.forEach((n, i) => {
      const status = rows[i]![5];
      if (n.status === 'open' || n.ack === null) expect(status).toBe(n.statusLabel);
      else
        expect(status).toBe(
          [n.statusLabel, n.ack.due, n.ack.note].filter((part) => part !== '').join(' · '),
        );
    });
    expect(model.nudges.some((n) => n.status !== 'open' && n.ack !== null)).toBe(true);
  });

  it('a risk row with no machine chip is just its model', () => {
    const model = actionCenterModel(
      facts({ ...board, risk: [{ machine: 'gone', model: 'FMH 500', score: 2, why: 'x' }] }),
      t,
    );
    expect(actionCenterSheets(model)[1]!.rows[1]).toEqual(['FMH 500', 2, 'x']);
  });
});
