// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ActionCenterBoardReply } from '@uptimo/shared';
import { en } from '@uptimo/shared/i18n';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { topStrips } from '../../../../ui/v2/action-strip.js';
import type { Translate } from '../../figures/read.js';
import { realReply } from '../../figures/real-reply.js';
import type { CostliestModel } from '../model.js';
import { costliestRows, dashboardStrips } from '../sweep.js';

/** The edges of the Dashboard's sweep helpers (#706 batch A): empty, held, singular, non-finite, never re-rounded. */
const t: Translate = (key, values = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{?(\w+)\}?\}/g, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );
const real = realReply();
const board = (open: number, high: number, med: number): ActionCenterBoardReply =>
  ({ counts: { open }, bySeverity: { high, med, low: 0, info: 0 } }) as ActionCenterBoardReply;
const withoutTeamFocus = (status: 'not_computed' | 'ready', value: unknown): FiguresReply =>
  ({
    ...real,
    figures: real.figures.map((f) => (f.key === 'team-focus' ? { ...f, status, value } : f)),
  }) as FiguresReply;
describe('dashboardStrips edges', () => {
  it('no board, or nothing open, gives zero Action Center counts the kit then drops', () => {
    for (const b of [null, board(0, 0, 0)]) {
      const strips = dashboardStrips(b, real, t);
      expect(strips.map((s) => [s.key, s.count])).toEqual([
        ['ac-high', 0],
        ['ac-medium', 0],
        ['tf', expect.any(Number)],
      ]);
      expect(topStrips(strips).map((s) => s.key)).toEqual(['tf']);
    }
  });

  it('a Team Focus figure not computed, or with nothing in it, counts 0', () => {
    for (const reply of [withoutTeamFocus('not_computed', null), withoutTeamFocus('ready', null)])
      expect(dashboardStrips(board(1, 1, 0), reply, t)[2]!.count).toBe(0);
  });

  it('says one in the singular', () => {
    const strips = dashboardStrips(board(2, 1, 1), real, t);
    expect(strips[0]!.what).toBe('high-priority decision needs attention');
    expect(strips[1]!.what).toBe('decision to watch');
  });

  it('counts only open and in-progress Team Focus actions', () => {
    const value = (statuses: string[]) => ({
      extra: statuses.map((status, i) => ({
        key: `fc|m${i}|2026-12`,
        lane: 'A',
        title: `Action ${i}`,
        stake: 1,
        status,
      })),
    });
    const reply = withoutTeamFocus('ready', value(['open', 'prog', 'done', 'skip']));
    const tf = dashboardStrips(null, reply, t)[2]!;
    expect(tf).toMatchObject({ count: 2, what: 'Team Focus actions open', severity: 'low' });
  });
});

describe('costliestRows edges', () => {
  const card = (rows: { text: string; sort?: string | number }[][] | null): CostliestModel =>
    ({
      title: 'Problems costing the most downtime',
      sub: '',
      empty: '',
      table: rows === null ? null : { rows },
      link: { href: '/', label: '' },
    }) as unknown as CostliestModel;

  it('no table is no rows', () => {
    expect(costliestRows(card(null), t)).toEqual([]);
  });

  it('never re-rounds the printed hours, and keeps two problems of the same name apart', () => {
    const cells = (problem: string, text: string, sort: number) => [
      { text: problem, sort: problem },
      { text, sort },
      { text: '1.00%', sort: 1 },
      { text: '1', sort: 1 },
    ];
    const rows = costliestRows(
      card([cells('Leak', '1,234.5', 1234.46), cells('Leak', '0.1', 0.06)]),
      t,
    );
    expect(rows.map((r) => [r.key, r.label, r.value, r.valueText])).toEqual([
      ['0', 'Leak', 1234.46, '1,234.5'],
      ['1', 'Leak', 0.06, '0.1'],
    ]);
    expect(rows[1]!.countText).toBe('Breakdowns: 1');
  });

  it('an hours cell with no number gives NaN, not zero', () => {
    const rows = costliestRows(
      card([[{ text: 'Noise' }, { text: '—' }, { text: '—' }, { text: '0' }]]),
      t,
    );
    expect(rows[0]!.value).toBeNaN();
    expect(rows[0]!.valueText).toBe('—');
  });
});
