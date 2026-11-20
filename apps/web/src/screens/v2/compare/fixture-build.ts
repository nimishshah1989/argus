import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { Point } from '../../../ui/v2/points.js';
import type { TrendData } from '../../../ui/v2/trend-chart.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import { glue, pt } from '../fixtures/text.js';
import { hours, lakh, rupees, weekly, type Stats } from './fixture-stats.js';
import { RATE } from './fixture-rows.js';

const sign = (n: number) => (n < 0 ? '−' : '+');
const noun = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const mark = (s: Stats) => `{{machine:${s.machine.code}|${s.machine.code}}}`;
const cellMark = (s: Stats) => `{{cell:${s.machine.cell}|${s.machine.cell}}}`;

/** The worse of the pair (more hours lost) first, the better second. */
export const byLoss = (a: Stats, b: Stats): [Stats, Stats] =>
  a.tenths >= b.tenths ? [a, b] : [b, a];

/** A problem's breakdowns and hours on one machine, as text, in the colour of whether it is the bigger loss. */
const causeText = (s: Stats, cause: string, loss: boolean) => {
  const c = s.causes.get(cause) ?? { count: 0, tenths: 0 };
  const text = `${noun(c.count, 'breakdown', 'breakdowns')}, ${(c.tenths / 10).toFixed(1)} h`;
  return loss ? `!!${text}!!` : `++${text}++`;
};

/** The problems the pair differs most on, biggest gap in hours first. */
export function topCauses(worse: Stats, better: Stats, n = 3): string[] {
  const names = new Set([...worse.causes.keys(), ...better.causes.keys()]);
  const gapOf = (c: string) =>
    Math.abs((worse.causes.get(c)?.tenths ?? 0) - (better.causes.get(c)?.tenths ?? 0));
  return [...names].sort((x, y) => gapOf(y) - gapOf(x)).slice(0, n);
}

export function differences(worse: Stats, better: Stats): Point[] {
  return topCauses(worse, better).map((cause) => {
    const w = worse.causes.get(cause)?.tenths ?? 0;
    const b = better.causes.get(cause)?.tenths ?? 0;
    return pt(
      `**${cause}**: ${causeText(worse, cause, w >= b)} on ${mark(worse)} against ${causeText(better, cause, b > w)} on ${mark(better)}`,
    );
  });
}

/** The answer first: who loses how many times more, with the pair's shared ground and the biggest cause behind it. */
export function verdict(worse: Stats, better: Stats): VerdictData {
  const ratio = worse.tenths / better.tenths;
  const [top] = topCauses(worse, better, 1);
  const gapTenths = worse.tenths - better.tenths;
  const share = Math.round(
    (((worse.causes.get(top!)?.tenths ?? 0) - (better.causes.get(top!)?.tenths ?? 0)) / gapTenths) *
      100,
  );
  const ageGap = worse.year.age - better.year.age;
  return {
    context: `Friday 20-Nov-2026 · this year so far · ${worse.machine.typeLabel}`,
    headline:
      ratio < 1.05
        ? pt(
            `${mark(worse)} and ${mark(better)} lose ++about the same hours++ doing the same work.`,
          )
        : pt(
            `${mark(worse)} loses !!${ratio.toFixed(1)}× more hours!! than ${mark(better)} doing the same work.`,
          ),
    why: [
      pt(
        `Both are **${worse.machine.typeLabel.toLowerCase()}s**: ${mark(worse)} is in ${cellMark(worse)}, ${mark(better)} in ${cellMark(better)}`,
      ),
      pt(
        `${mark(worse)} lost !!${hours(worse).toFixed(1)} h!! this year, ${mark(better)} ++${hours(better).toFixed(1)} h++`,
      ),
      pt(
        `**${top}** explains **${share}%** of the gap: ${causeText(worse, top!, true)} on ${mark(worse)}, ${causeText(better, top!, false)} on ${mark(better)}`,
      ),
      pt(
        Math.abs(ageGap) <= 2
          ? `Age does not explain it: **${worse.year.age}** and **${better.year.age}** years`
          : `${mark(worse)} is **${Math.abs(ageGap)} years** ${ageGap > 0 ? 'older' : 'younger'}`,
      ),
    ],
  };
}

const change = (now: number, was: number, text: string) => ({
  text,
  up: now > was,
  good: now <= was,
});

/** How far apart the pair is, against how far apart the same two were last year. */
export function kpis(worse: Stats, better: Stats): KpiData[] {
  const gapH = (worse.tenths - better.tenths) / 10;
  const lastH = (worse.year.last.tenths - better.year.last.tenths) / 10;
  const gapN = worse.count - better.count;
  const lastN = worse.year.last.count - better.year.last.count;
  const gapR = rupees(worse) - rupees(better);
  const lastR = lastH * RATE;
  return [
    {
      id: 'hours',
      label: 'Extra hours lost',
      icon: 'clock',
      value: glue(`${gapH.toFixed(1)} h`),
      delta: change(
        gapH,
        lastH,
        glue(`${sign(gapH - lastH)}${Math.abs(gapH - lastH).toFixed(1)} h`),
      ),
      period: 'vs last year’s gap',
      meaning: 'What the worse of the two loses beyond the better',
      more: `${(worse.tenths / better.tenths).toFixed(1)} times the hours`,
    },
    {
      id: 'count',
      label: 'Extra breakdowns',
      icon: 'alert',
      value: String(gapN),
      delta: change(gapN, lastN, `${sign(gapN - lastN)}${Math.abs(gapN - lastN)}`),
      period: 'vs last year’s gap',
      meaning: 'How many more times the worse one stopped',
      more: `${worse.count} against ${better.count} this year`,
    },
    {
      id: 'money',
      label: 'Extra money lost',
      icon: 'rupee',
      value: lakh(gapR),
      delta: change(gapR, lastR, glue(`${sign(gapR - lastR)}${lakh(Math.abs(gapR - lastR))}`)),
      period: 'vs last year’s gap',
      meaning: 'Production value lost to the gap',
      more: 'At ₹ 3,329 an hour of breakdown',
    },
  ];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The last 12 weeks, each named by its Friday, ending on 20-Nov-2026. */
const WEEKS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 10, 20) - (11 - i) * 7 * 86_400_000);
  return `${String(d.getUTCDate()).padStart(2, '0')}-${MONTHS[d.getUTCMonth()]}`;
});

export function trend(a: Stats, b: Stats): TrendData {
  const [w, bt] = byLoss(a, b);
  const sum = (s: Stats) =>
    weekly(s)
      .reduce((x, y) => x + y, 0)
      .toFixed(1);
  return {
    title: 'Breakdown hours a week',
    sub: '12 weeks · hover any week for its exact hours',
    aria: `Breakdown hours a week for ${w.machine.code} and ${bt.machine.code} over the last 12 weeks: ${sum(w)} h and ${sum(bt)} h in all`,
    categoryLabel: 'Week ending',
    valueLabel: 'Hours',
    categories: WEEKS,
    series: [
      { name: w.machine.code, values: weekly(w), tone: 'danger' },
      { name: bt.machine.code, values: weekly(bt), tone: 'info' },
    ],
  };
}
