import { describe, expect, it } from 'vitest';
import { realReply } from '../figures/real-reply.js';
import { hasYardstick, tilesIn } from '../insight.js';
import { realT } from '../printed-page/test-support.js';
import { moneyMattersModel } from './adapter.js';
import type { MoneyPage } from './model.js';

/**
 * Ticket 644 (ADR 0031 §6, ADR 0034, ADR 0035): S22's model from the engine's reply on the frozen 11 November key.
 * Figures only: every engine KPI printed once, every tile with a yardstick, each takeaway naming the measured figures.
 */
const reply = realReply();
/** Built on first use, so an unbuilt adapter fails each test on its own. */
let built: MoneyPage | undefined;
const model = (): MoneyPage =>
  (built ??= moneyMattersModel(reply, realT, { money: true }) as MoneyPage);
const kpis = (
  reply.figures.find((f) => f.key === 'money-matters')!.value as {
    pages: { kpis: { label: string; value: string; sub: string }[] }[];
  }
).pages[0]!.kpis;
const tile = (label: string) =>
  model()
    .groups.flatMap((g) => g.figures)
    .find((f) => f.label === label)!;
const says = (point: { text: string }[]) => point.map((s) => s.text).join('');

describe('S22 Money Matters from the engine reply', () => {
  it('prints each of the ten engine KPIs once, as printed, in the cost, next and price groups', () => {
    expect(model().refused).toBe(false);
    expect(model().groups.map((g) => g.id)).toEqual(['cost', 'next', 'price']);
    const shown = model().groups.flatMap((g) => g.figures.map((f) => [f.label, f.value, f.sub]));
    expect([...shown].sort()).toEqual(kpis.map((k) => [k.label, k.value, k.sub]).sort());
  });

  it('gives every tile a yardstick', () => {
    expect(tilesIn(model()).filter((t) => !hasYardstick(t))).toEqual([]);
  });

  it('sets the money tiles against the yearly loss and next month against the average month', () => {
    for (const [label, pct] of [
      ['Money lost to breakdowns', '85%'],
      ['Could have been added', '69%'],
      ['Open Team Focus actions', '85%'],
    ]) {
      expect(tile(label!).yardstick, label).toContain(pct);
      expect(tile(label!).yardstick, label).toContain('₹ 64.65 lakh');
    }
    expect(tile('Next month, expected').yardstick).toContain('+6%');
    expect(tile('Plan for (80%)').yardstick).toContain('+46%');
    expect(tile('Worst case (90%)').yardstick).toContain('+73%');
    expect(tile('Throughput per machine-hour').yardstick).toContain('125');
  });

  it('opens with what breakdowns cost, what could have been added and the largest loss', () => {
    const verdict = [says(model().verdict.headline), ...model().verdict.why.map(says)].join(' ');
    for (const figure of ['₹ 55.08 lakh', '3,060 hrs in 311 days', '₹ 44.87 lakh a year'])
      expect(verdict).toContain(figure);
    for (const figure of ['Axis motor / drive / encoder / servo', '₹ 8.73 lakh', '15.8%'])
      expect(verdict).toContain(figure);
  });

  it('has a takeaway for the levers, the chart and the lost table, each naming its figures', () => {
    expect(Object.keys(model().takeaways ?? {}).sort()).toEqual(['chart', 'levers', 'lost']);
    const text = (id: string) => model().takeaways?.[id]?.text ?? '';
    for (const figure of ['5', '24', '50%']) expect(text('lost')).toContain(figure);
    for (const figure of ['Axis motor / drive / encoder / servo', '2.7'])
      expect(text('chart')).toContain(figure);
    for (const figure of [
      'Bring poor machines back to normal',
      '₹ 25.85 lakh',
      '58%',
      '₹ 44.87 lakh',
      '1,650',
    ])
      expect(text('levers')).toContain(figure);
  });

  it('keeps every lever row and every problem row, the lever name said apart from its note', () => {
    expect(model().tables.map((t) => t.rows.length)).toEqual([5, 24]);
    const levers = model().tables[0]!.rows.map((r) => r[0]!.text);
    expect(levers.some((cell) => cell.includes('goodThe'))).toBe(false);
    expect(levers[0]).toContain('Fix repeat problems for good');
  });

  it('is null, never an invented figure, when the engine has not computed the page', () => {
    const none = { ...reply, figures: reply.figures.filter((f) => f.key !== 'money-matters') };
    expect(moneyMattersModel(none, realT, { money: true })).toBeNull();
    const notReady = {
      ...reply,
      figures: reply.figures.map((f) =>
        f.key === 'money-matters' ? { ...f, status: 'not_computed' as const } : f,
      ),
    };
    expect(moneyMattersModel(notReady, realT, { money: true })).toBeNull();
  });
});
