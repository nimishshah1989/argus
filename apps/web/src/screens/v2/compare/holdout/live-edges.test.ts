// @vitest-environment node
import i18next, { type TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { en, gu } from '@uptimo/shared/i18n';
import type { CompareReply } from '@uptimo/shared/compare-pair';
import { NotComputed } from '../../figures/live-error.js';
import { answerKey, realT } from '../../printed-page/test-support.js';
import { liveCompare } from '../live.js';
import type { CompareModel } from '../model.js';

/** Ticket 587, hidden: zeros, ties, the worse machine on the right, missing facts, Gujarati, and money. */

const FIGURE = answerKey('compare', 'compare', 43).figures[0]!;
const M28 = '10000000-0000-0000-0000-000000000028';
const M22 = '10000000-0000-0000-0000-000000000022';
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
const reply = (a: Partial<Year>, b: Partial<Year>, rate: number | null = 2000): CompareReply => ({
  asOf: '2026-11-11',
  pair: { a: 'VC-28', b: 'VC-22' },
  options: ['VC-28', 'VC-22'],
  figure: { ...FIGURE, drill: { type: 'machine', ids: [M28, M22] } },
  years: [year({ code: 'VC-28', ...a }), year({ code: 'VC-22', ...b })],
  rate,
});
const plain = (s: string) => s.replace(/\s/g, ' ');
const said = (point: { text: string }[]) => plain(point.map((seg) => seg.text).join(''));
const fig = (m: CompareModel, side: 0 | 1, id: string) =>
  m.boxes[side].figures.find((f) => f.id === id)!;
const noNumberNonsense = (m: CompareModel) => {
  const text = JSON.stringify({ ...m, tables: undefined });
  expect(text).not.toMatch(/NaN|Infinity|undefined/);
};

describe('liveCompare, hidden edges', () => {
  it('a machine with no breakdowns: no NaN, no Infinity, the other is simply worse', () => {
    const m = liveCompare(
      reply(
        { count: 8, hours: 20, causes: [{ code: 'ATC', count: 8, hours: 20 }] },
        { count: 0, hours: 0 },
      ),
      realT,
    );
    noNumberNonsense(m);
    expect(said(m.verdict.headline)).toBe('VC-28 lost 20.0 h this year; VC-22 lost none.');
    expect(fig(m, 0, 'hours')).toMatchObject({ mark: 'worse', markText: 'Worse' });
    expect(fig(m, 1, 'hours')).toMatchObject({ mark: 'better', markText: 'Better' });
    expect(fig(m, 1, 'mttr')).toMatchObject({
      value: '—',
      mark: 'same',
      markText: 'Nothing to compare',
    });
    expect(fig(m, 0, 'mttr')).toMatchObject({ mark: 'same', markText: 'Nothing to compare' });
    expect(m.kpis[0]!.more).toBe('');
  });

  it('two machines with no breakdowns at all are about the same', () => {
    const m = liveCompare(reply({}, {}), realT);
    noNumberNonsense(m);
    expect(said(m.verdict.headline)).toBe(
      'VC-28 and VC-22 lose about the same hours doing the same work.',
    );
    expect(m.differences.points).toEqual([]);
    for (const side of [0, 1] as const)
      for (const f of m.boxes[side].figures) expect(f.mark, f.id).toBe('same');
  });

  it('under 1.05 times apart is about the same, both sides', () => {
    const m = liveCompare(reply({ count: 10, hours: 10.4 }, { count: 10, hours: 10 }), realT);
    expect(said(m.verdict.headline)).toBe(
      'VC-28 and VC-22 lose about the same hours doing the same work.',
    );
    expect(fig(m, 0, 'hours').mark).toBe('same');
    expect(fig(m, 1, 'hours').mark).toBe('same');
  });

  it('the worse machine leads the sentences and the chart even when it is machine B', () => {
    const m = liveCompare(
      reply(
        { count: 2, hours: 4, weekly: [1, ...Array.from({ length: 11 }, () => 0)] },
        { count: 6, hours: 12, weekly: [2, ...Array.from({ length: 11 }, () => 0)] },
      ),
      realT,
    );
    expect(said(m.verdict.headline)).toBe(
      'VC-22 loses 3.0× more hours than VC-28 doing the same work.',
    );
    expect(m.boxes.map((box) => box.chip.label)).toEqual(['VC-28', 'VC-22']);
    expect(m.trend.series.map((s) => [s.name, s.tone])).toEqual([
      ['VC-22', 'danger'],
      ['VC-28', 'info'],
    ]);
    expect(fig(m, 1, 'hours').markText).toBe('3.0× more');
  });

  it('a missing age or cell leaves that part out instead of printing null', () => {
    const m = liveCompare(
      reply({ count: 4, hours: 8, age: null, cell: null }, { count: 2, hours: 2, age: 3 }),
      realT,
    );
    noNumberNonsense(m);
    expect(JSON.stringify(m.verdict)).not.toContain('null');
    expect(plain(m.boxes[0].sub)).toBe('Vertical Machining Center');
    expect(said(m.verdict.why[0]!)).toBe('Both are Vertical Machining Center');
    expect(m.verdict.why.map(said).some((line) => line.startsWith('Age'))).toBe(false);
  });

  it('ages more than two years apart say which is older', () => {
    const m = liveCompare(
      reply({ count: 4, hours: 8, age: 12 }, { count: 2, hours: 2, age: 4 }),
      realT,
    );
    expect(m.verdict.why.map(said)).toContain('VC-28 is 8 years older');
  });

  it('a page the engine could not print is not computed', () => {
    const broken = { ...reply({ count: 1, hours: 1 }, { count: 1, hours: 1 }) };
    broken.figure = { ...broken.figure, status: 'not_computed' };
    expect(() => liveCompare(broken, realT)).toThrow(NotComputed);
  });

  it('reads in Gujarati with no key showing', () => {
    const gujarati = i18next.createInstance();
    void gujarati.init({
      lng: 'gu',
      fallbackLng: 'en',
      resources: { en: { translation: { ...en } }, gu: { translation: { ...gu } } },
      interpolation: { escapeValue: false },
    });
    const m = liveCompare(
      reply({ count: 4, hours: 8 }, { count: 2, hours: 2 }),
      gujarati.t.bind(gujarati) as unknown as TFunction,
    );
    expect(JSON.stringify({ ...m, tables: undefined })).not.toContain('v2cmp.');
    expect(m.words.pickA).toBe('પહેલું મશીન');
  });

  it('money rows and figures appear only with a rate', () => {
    const withRate = liveCompare(reply({ count: 4, hours: 8 }, { count: 2, hours: 2 }), realT);
    expect(withRate.kpis.map((k) => k.id)).toEqual(['hours', 'count', 'money']);
    const without = liveCompare(reply({ count: 4, hours: 8 }, { count: 2, hours: 2 }, null), realT);
    expect(without.boxes[1].figures).toHaveLength(5);
  });
});
