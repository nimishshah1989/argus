import type { TFunction } from 'i18next';
import type { CompareReply } from '@uptimo/shared/compare-pair';
import type { CompareFigure } from '../../../ui/v2/domain/compare-box.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { Point, Seg } from '../../../ui/v2/points.js';
import type { TrendData } from '../../../ui/v2/trend-chart.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import { cellChip, machineChip, shortDate, type Page } from '../printed-page/printed.js';
import { tablesOf } from '../printed-page/page-model.js';
import { say, strong } from '../printed-page/segs.js';
import { pageWords } from '../printed-page/words.js';
import type { CompareModel } from './model.js';

/** A reply with a comparison in it. */
export type ComparedReply = CompareReply & {
  pair: NonNullable<CompareReply['pair']>;
  years: NonNullable<CompareReply['years']>;
};

type Year = ComparedReply['years'][0];
type Words = (key: string, values?: Record<string, unknown>) => string;

const SAME = 1.05;
const NB = ' ';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const h1 = (v: number) => `${v.toFixed(1)}${NB}h`;
const lakh = (rupees: number) => `₹${NB}${(rupees / 100000).toFixed(2)}${NB}lakh`;
const rupee = (rate: number) => `₹${NB}${rate.toLocaleString('en-IN')}`;
const loss = (text: string): Seg => ({ text, tone: 'loss' });
const gain = (text: string): Seg => ({ text, tone: 'gain' });
const chip = (code: string): Seg => ({ text: code, entity: machineChip(code) });

/** Larger ÷ smaller; both 0 is 1, exactly one 0 is Infinity. */
export function ratio(x: number, y: number): number {
  if (x === 0 && y === 0) return 1;
  return Math.min(x, y) === 0 ? Infinity : Math.max(x, y) / Math.min(x, y);
}

type Metric = {
  id: string;
  get: (y: Year) => number;
  show: (v: number) => string;
  mark: string;
  lowerIsBetter?: false;
  size?: (v: number) => number;
  needsCount?: true;
};

const mtbfShow = (v: number) => `${Math.round(v).toLocaleString('en-IN')}${NB}h`;

function metrics(rate: number | null): Metric[] {
  const all: Metric[] = [
    { id: 'hours', get: (y) => y.hours, show: h1, mark: 'more' },
    { id: 'count', get: (y) => y.count, show: String, mark: 'more' },
    {
      id: 'mttr',
      get: (y) => y.hours / y.count,
      show: h1,
      mark: 'slower',
      needsCount: true,
    },
    {
      id: 'mtbf',
      get: (y) => (y.plannedHours - y.hours) / y.count,
      show: mtbfShow,
      mark: 'shorter',
      lowerIsBetter: false,
      needsCount: true,
    },
    {
      id: 'avail',
      get: (y) => (y.plannedHours > 0 ? ((y.plannedHours - y.hours) / y.plannedHours) * 100 : 100),
      show: (v) => `${v.toFixed(2)}%`,
      mark: 'downtime',
      lowerIsBetter: false,
      size: (v) => 100 - v,
    },
  ];
  if (rate !== null) {
    all.push({ id: 'money', get: (y) => y.hours * rate, show: lakh, mark: 'more' });
  }
  return all;
}

/** Both boxes' figures in the same order, the biggest gap first. */
function figures(
  ys: [Year, Year],
  rate: number | null,
  t: Words,
): [CompareFigure[], CompareFigure[]] {
  const rows = metrics(rate).map((m) => {
    const none = m.needsCount === true && ys.some((y) => y.count === 0);
    const v = [m.get(ys[0]), m.get(ys[1])] as const;
    const size = m.size ?? ((x: number) => x);
    const r = none ? 1 : ratio(size(v[0]), size(v[1]));
    const hint =
      m.id === 'money' && rate !== null
        ? t('v2cmp.fig.money.hint', { rate: rupee(rate) })
        : t(`v2cmp.fig.${m.id}.hint`);
    const side = (mine: number, other: number, y: Year): CompareFigure => {
      const worse = m.lowerIsBetter === false ? mine < other : mine > other;
      const mark = none || r < SAME ? 'same' : worse ? 'worse' : 'better';
      const key = none ? 'none' : mark === 'worse' && r !== Infinity ? m.mark : mark;
      return {
        id: m.id,
        label: t(`v2cmp.fig.${m.id}.label`),
        hint,
        value: m.needsCount && y.count === 0 ? '—' : m.show(mine),
        mark,
        markText: t(`v2cmp.mark.${key}`, { n: r.toFixed(1) }),
      };
    };
    return { r, pair: [side(v[0], v[1], ys[0]), side(v[1], v[0], ys[1])] as const };
  });
  rows.sort((p, q) => q.r - p.r);
  return [rows.map((x) => x.pair[0]), rows.map((x) => x.pair[1])];
}

const causeOf = (y: Year, code: string) =>
  y.causes.find((c) => c.code === code) ?? { count: 0, hours: 0 };

/** The codes the pair differs most on, biggest gap in hours first. */
function topCodes(worse: Year, better: Year, n = 3): string[] {
  const codes = [...new Set([...worse.causes, ...better.causes].map((c) => c.code))];
  const gap = (c: string) => Math.abs(causeOf(worse, c).hours - causeOf(better, c).hours);
  return codes.sort((x, y) => gap(y) - gap(x)).slice(0, n);
}

const codeName = (code: string, t: Words) => (code === '—' ? t('v2cmp.noCode') : code);
const causeText = (y: Year, code: string, t: Words) => {
  const c = causeOf(y, code);
  return t('v2cmp.causeText', { count: c.count, hours: c.hours.toFixed(1) });
};

function headlineOf(worse: Year, better: Year, t: Words): Point {
  const [w, b] = [chip(worse.code), chip(better.code)];
  const r = ratio(worse.hours, better.hours);
  if (r < SAME) {
    return say(t('v2cmp.say.headlineSame'), {
      worse: w,
      better: b,
      same: gain(t('v2cmp.sameHours')),
    });
  }
  if (better.hours === 0) {
    return say(t('v2cmp.say.headlineNone'), { worse: w, better: b, hours: loss(h1(worse.hours)) });
  }
  const ratioSeg = loss(t('v2cmp.ratio', { n: r.toFixed(1) }));
  return say(t('v2cmp.say.headline'), { worse: w, better: b, ratio: ratioSeg });
}

/** Nothing when an age is unknown; "about the same age" within 2 years, else who is older. */
function ageLine(worse: Year, better: Year, t: Words): Point[] {
  if (worse.age === null || better.age === null) return [];
  const diff = worse.age - better.age;
  if (Math.abs(diff) <= 2) {
    const [ageWorse, ageBetter] = [strong(String(worse.age)), strong(String(better.age))];
    return [say(t('v2cmp.say.ageSame'), { ageWorse, ageBetter })];
  }
  const years = strong(t('v2cmp.years', { count: Math.abs(diff) }));
  return [
    say(t(diff > 0 ? 'v2cmp.say.older' : 'v2cmp.say.younger'), { worse: chip(worse.code), years }),
  ];
}

/** The answer first, then why: the shared ground, the hours, the biggest code and age. */
function verdictOf(worse: Year, better: Year, asOf: string, t: Words): VerdictData {
  const [w, b] = [chip(worse.code), chip(better.code)];
  const kind = strong(worse.category ?? '—');
  const chipOf = (c: string): Seg => ({ text: c, entity: cellChip(c) });
  const why: Point[] =
    worse.cell === null || better.cell === null
      ? [say(t('v2cmp.say.kindNoCell'), { kind })]
      : [
          say(t('v2cmp.say.kind'), {
            kind,
            a: w,
            cellA: chipOf(worse.cell),
            b,
            cellB: chipOf(better.cell),
          }),
        ];
  why.push(
    say(t('v2cmp.say.lost'), {
      worse: w,
      better: b,
      worseHours: loss(h1(worse.hours)),
      betterHours: gain(h1(better.hours)),
    }),
  );
  const gap = worse.hours - better.hours;
  const [top] = topCodes(worse, better, 1);
  if (gap > 0 && top !== undefined) {
    const share = (causeOf(worse, top).hours - causeOf(better, top).hours) / gap;
    why.push(
      say(t('v2cmp.say.cause'), {
        cause: strong(codeName(top, t)),
        share: strong(`${Math.round(share * 100)}%`),
        worseText: loss(causeText(worse, top, t)),
        betterText: gain(causeText(better, top, t)),
        worse: w,
        better: b,
      }),
    );
  }
  why.push(...ageLine(worse, better, t));
  const context = t('v2cmp.context', { date: shortDate(asOf), category: worse.category ?? '—' });
  return { context, headline: headlineOf(worse, better, t), why };
}

const KPI = {
  hours: { icon: 'clock', show: h1 },
  count: { icon: 'alert', show: String },
  money: { icon: 'rupee', show: lakh },
} as const;

/** One key figure: this year's gap, and how it moved against last year's gap. */
function kpi(t: Words, id: keyof typeof KPI, [now, was]: [number, number], more: string): KpiData {
  const { icon, show } = KPI[id];
  const diff = now - was;
  return {
    id,
    label: t(`v2cmp.kpi.${id}.label`),
    icon,
    value: show(now),
    delta: {
      text: `${diff < 0 ? '−' : '+'}${show(Math.abs(diff))}`,
      up: now > was,
      good: now <= was,
    },
    period: t('v2cmp.kpi.period'),
    meaning: t(`v2cmp.kpi.${id}.meaning`),
    more,
  };
}

function kpisOf(worse: Year, better: Year, rate: number | null, t: Words): KpiData[] {
  const [wl, bl] = [worse.last, better.last];
  const hours: [number, number] = [worse.hours - better.hours, wl.hours - bl.hours];
  const count: [number, number] = [worse.count - better.count, wl.count - bl.count];
  const n = ratio(worse.hours, better.hours).toFixed(1);
  const counts = { worse: worse.count, better: better.count };
  const out = [
    kpi(t, 'hours', hours, better.hours === 0 ? '' : t('v2cmp.kpi.hours.more', { n })),
    kpi(t, 'count', count, t('v2cmp.kpi.count.more', counts)),
  ];
  if (rate !== null) {
    const more = t('v2cmp.kpi.money.more', { rate: rupee(rate) });
    out.push(kpi(t, 'money', [hours[0] * rate, hours[1] * rate], more));
  }
  return out;
}

/** The 12 weeks ending on `asOf`, each named by its last day (DD-Mon). */
function trendOf(worse: Year, better: Year, asOf: string, t: Words): TrendData {
  const end = Date.parse(`${asOf}T00:00:00Z`);
  const categories = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(end - 7 * (11 - i) * 86_400_000);
    return `${String(d.getUTCDate()).padStart(2, '0')}-${MONTHS[d.getUTCMonth()]}`;
  });
  const sum = (y: Year) => y.weekly.reduce((s, v) => s + v, 0).toFixed(1);
  return {
    title: t('v2cmp.trend.title'),
    sub: t('v2cmp.trend.sub'),
    aria: t('v2cmp.trend.aria', {
      worse: worse.code,
      better: better.code,
      worseHours: sum(worse),
      betterHours: sum(better),
    }),
    categoryLabel: t('v2cmp.trend.category'),
    valueLabel: t('v2cmp.trend.value'),
    categories,
    series: [
      { name: worse.code, values: worse.weekly, tone: 'danger' },
      { name: better.code, values: better.weekly, tone: 'info' },
    ],
  };
}

/**
 * Everything the live Compare prints (ticket 587, ADR 0021 §2–5): verdict, picker, key figures, the two boxes,
 * "What is different", the weekly chart, v1's six tables and the source line, from the pair's years so far and the
 * engine's page. The rules are the ticket's "How it must behave"; every word is a `v2cmp.*` catalogue key.
 */
export function compareModel(reply: ComparedReply, page: Page, tf: TFunction): CompareModel {
  const t: Words = (key, values) => tf(key, { ...values }) as string;
  const [a, b] = reply.years;
  const [worse, better] = a.hours >= b.hours ? [a, b] : [b, a];
  const [fa, fb] = figures(reply.years, reply.rate, t);
  const box = (y: Year, figs: CompareFigure[]) => ({
    chip: machineChip(y.code),
    sub: t(y.age === null ? 'v2cmp.subNoAge' : 'v2cmp.sub', {
      kind: y.category ?? '—',
      age: y.age,
    }),
    figures: figs,
  });
  const words = pageWords(tf, 'v2cmp.source');
  const points = topCodes(worse, better).map((code) =>
    say(t('v2cmp.say.difference'), {
      cause: strong(codeName(code, t)),
      worseText: loss(causeText(worse, code, t)),
      worse: chip(worse.code),
      betterText: gain(causeText(better, code, t)),
      better: chip(better.code),
    }),
  );
  return {
    verdict: verdictOf(worse, better, reply.asOf, t),
    pick: { ...reply.pair, options: reply.options.map((code) => ({ key: code, label: code })) },
    kpis: kpisOf(worse, better, reply.rate, t),
    boxes: [box(a, fa), box(b, fb)],
    differences: {
      title: t('v2cmp.differences.title'),
      points,
      action: t('v2cmp.differences.action'),
      doneText: t('v2cmp.differences.done'),
      done: false,
    },
    trend: trendOf(worse, better, reply.asOf, t),
    tables: { items: tablesOf(page.tables, words), words: words.table },
    source: t('v2cmp.source', { date: shortDate(reply.asOf) }),
    words: { why: t('v2cmp.why'), pickA: t('v2cmp.pickA'), pickB: t('v2cmp.pickB') },
  };
}
