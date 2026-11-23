// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { CompareReply } from '@uptimo/shared/compare-pair';
import { NotComputed } from '../figures/live-error.js';
import { answerKey, realT } from '../printed-page/test-support.js';
import { compareQuery, liveCompare } from './live.js';
import type { CompareModel } from './model.js';

const http = vi.hoisted(() => vi.fn());
vi.mock('../../../data/index.js', async (actual) => ({
  ...(await actual<typeof import('../../../data/index.js')>()),
  http,
}));

/**
 * Ticket 587 (ADR 0021 §2–5): the live Compare model from `GET /analytics/compare`. The page is the engine's frozen
 * VC-28 / VC-22 page; the years are invented so every figure is easy to check by hand (rate ₹ 2,000 an hour).
 */

const FIGURE = answerKey('compare', 'compare', 43).figures[0]!;
const M28 = '10000000-0000-0000-0000-000000000028';
const M22 = '10000000-0000-0000-0000-000000000022';
const year = (over: Partial<NonNullable<CompareReply['years']>[0]>) => ({
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
const A = year({
  machineId: M28,
  code: 'VC-28',
  cell: 'Cell 3',
  age: 7,
  count: 8,
  hours: 20,
  causes: [
    { code: 'ATC', count: 4, hours: 12 },
    { code: 'LIK', count: 2, hours: 5 },
    { code: '—', count: 2, hours: 3 },
  ],
  weekly: [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4],
  last: { count: 5, hours: 10 },
});
const B = year({
  machineId: M22,
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
});
const REPLY: CompareReply = {
  asOf: '2026-11-11',
  pair: { a: 'VC-28', b: 'VC-22' },
  options: ['VC-28', 'VC-22', 'VC-18'],
  figure: { ...FIGURE, drill: { type: 'machine', ids: [M28, M22] } },
  years: [A, B],
  rate: 2000,
};

const plain = (s: string) => s.replace(/\s/g, ' ');
const said = (point: { text: string }[]) => plain(point.map((seg) => seg.text).join(''));
const model = (reply: CompareReply = REPLY): CompareModel => liveCompare(reply, realT);
const fig = (m: CompareModel, side: 0 | 1, id: string) =>
  m.boxes[side].figures.find((f) => f.id === id)!;

describe('compareQuery', () => {
  it('asks for the pair, or for the engine’s own pair when none is chosen', async () => {
    http.mockResolvedValue(REPLY);
    const query = compareQuery({ a: 'VC-28', b: 'VC 22' });
    expect(query.queryKey).toEqual(['analytics-compare', 'VC-28', 'VC 22']);
    expect(await query.queryFn()).toEqual(REPLY);
    expect(http).toHaveBeenLastCalledWith('/api/v1/analytics/compare?a=VC-28&b=VC%2022');
    await compareQuery({ a: '', b: '' }).queryFn();
    expect(http).toHaveBeenLastCalledWith('/api/v1/analytics/compare');
  });
});

describe('liveCompare', () => {
  it('is not computed when the plant has no comparison', () => {
    const none: CompareReply = {
      ...REPLY,
      pair: null,
      options: [],
      years: null,
      figure: { ...FIGURE, value: null, drill: { type: 'machine', ids: [] } },
    };
    expect(() => model(none)).toThrow(NotComputed);
  });

  it('says who loses how many times more, with the shared ground and the biggest cause', () => {
    const m = model();
    expect(said(m.verdict.headline)).toBe(
      'VC-28 loses 2.0× more hours than VC-22 doing the same work.',
    );
    expect(m.verdict.why.map(said)).toEqual([
      'Both are Vertical Machining Center: VC-28 is in Cell 3, VC-22 in Cell 1',
      'VC-28 lost 20.0 h this year, VC-22 10.0 h',
      'ATC explains 100% of the gap: 4 breakdowns, 12.0 h on VC-28, 1 breakdown, 2.0 h on VC-22',
      'Age does not explain it: 7 and 6 years',
    ]);
    expect(plain(m.verdict.context)).toBe(
      '11-Nov-2026 · this year so far · Vertical Machining Center',
    );
  });

  it('keeps machine A on the left and the picker on the asked pair', () => {
    const m = model();
    expect(m.pick).toEqual({
      a: 'VC-28',
      b: 'VC-22',
      options: ['VC-28', 'VC-22', 'VC-18'].map((code) => ({ key: code, label: code })),
    });
    expect(m.boxes.map((box) => box.chip.label)).toEqual(['VC-28', 'VC-22']);
    expect(plain(m.boxes[0].sub)).toBe('Vertical Machining Center · 7 years old');
  });

  it('prints six figures a side, the biggest gap first, each marked against its twin', () => {
    const m = model();
    expect(m.boxes[0].figures.map((f) => f.id)).toEqual(m.boxes[1].figures.map((f) => f.id));
    expect(m.boxes[0].figures).toHaveLength(6);
    expect(m.boxes[0].figures[0]!.id).toBe('mtbf');
    expect(m.boxes[0].figures.at(-1)!.id).toBe('mttr');
    expect(fig(m, 0, 'hours')).toMatchObject({ mark: 'worse', markText: '2.0× more' });
    expect(plain(fig(m, 0, 'hours').value)).toBe('20.0 h');
    expect(fig(m, 1, 'hours')).toMatchObject({ mark: 'better', markText: 'Better' });
    expect(plain(fig(m, 0, 'mtbf').value)).toBe('623 h');
    expect(plain(fig(m, 1, 'mtbf').value)).toBe('1,248 h');
    expect(fig(m, 0, 'mtbf').markText).toBe('2.0× shorter');
    expect(fig(m, 0, 'avail')).toMatchObject({ value: '99.60%', markText: '2.0× more downtime' });
    expect(fig(m, 0, 'mttr')).toMatchObject({ mark: 'same', markText: 'About the same' });
    expect(plain(fig(m, 1, 'mttr').value)).toBe('2.5 h');
    expect(plain(fig(m, 0, 'money').value)).toBe('₹ 0.40 lakh');
    expect(plain(fig(m, 0, 'money').hint)).toBe('At ₹ 2,000 an hour');
  });

  it('sizes the gap against last year’s gap between the same two', () => {
    const [hours, count, money] = model().kpis;
    expect(hours).toMatchObject({ id: 'hours', delta: { up: true, good: false } });
    expect(plain(hours!.value)).toBe('10.0 h');
    expect(plain(hours!.delta.text)).toBe('+8.0 h');
    expect(hours!.more).toBe('2.0 times the hours');
    expect(count).toMatchObject({ id: 'count', value: '4', delta: { text: '+3' } });
    expect(count!.more).toBe('8 against 4 this year');
    expect(plain(money!.value)).toBe('₹ 0.20 lakh');
    expect(plain(money!.delta.text)).toBe('+₹ 0.16 lakh');
  });

  it('lists the three codes the two differ on most, and opens Team Focus', () => {
    const d = model().differences;
    expect(d.points.map(said)).toEqual([
      'ATC: 4 breakdowns, 12.0 h on VC-28 against 1 breakdown, 2.0 h on VC-22',
      'No code: 2 breakdowns, 3.0 h on VC-28 against 0 breakdowns, 0.0 h on VC-22',
      'SPN: 0 breakdowns, 0.0 h on VC-28 against 1 breakdown, 2.0 h on VC-22',
    ]);
    expect(d).toMatchObject({ title: 'What is different', action: 'Open Team Focus', done: false });
  });

  it('draws twelve weeks ending on the date, the worse machine first', () => {
    const trend = model().trend;
    expect(trend.categories).toEqual([
      '26-Aug',
      '02-Sep',
      '09-Sep',
      '16-Sep',
      '23-Sep',
      '30-Sep',
      '07-Oct',
      '14-Oct',
      '21-Oct',
      '28-Oct',
      '04-Nov',
      '11-Nov',
    ]);
    expect(trend.series).toEqual([
      { name: 'VC-28', values: A.weekly, tone: 'danger' },
      { name: 'VC-22', values: B.weekly, tone: 'info' },
    ]);
  });

  it('carries the engine’s six tables and the source line', () => {
    const m = model();
    expect(m.tables!.items.map((table) => table.title)).toEqual([
      'Health scorecard (0–10, adjusted for age)',
      'Health checkup',
      'Specifications',
      'VC-28 — longest breakdowns',
      'VC-22 — longest breakdowns',
      'By shift',
    ]);
    expect(m.source).toBe('Figures as of 11-Nov-2026 · source: the Argus breakdown log');
  });

  it('shows no money at all when the reply has no rate', () => {
    const m = model({ ...REPLY, rate: null });
    expect(m.kpis.map((k) => k.id)).toEqual(['hours', 'count']);
    expect(m.boxes[0].figures.map((f) => f.id)).not.toContain('money');
    const { tables, ...rest } = m;
    void tables;
    expect(JSON.stringify(rest)).not.toContain('₹');
  });
});
