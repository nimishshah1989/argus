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

/** Below this, two figures are about the same. */
const SAME = 1.05;
const NBSP = ' ';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const h1 = (v: number) => `${v.toFixed(1)}${NBSP}h`;
const lakh = (rupees: number) => `₹${NBSP}${(rupees / 100000).toFixed(2)}${NBSP}lakh`;
const sign = (n: number) => (n < 0 ? '−' : '+');
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
  show: (y: Year) => string;
  lowerIsBetter: boolean;
  /** What to compare to size the gap, when the figure itself hides it (availability near 100%). */
  size?: (v: number) => number;
  mark: 'more' | 'slower' | 'shorter' | 'downtime';
  /** Needs a breakdown on each side. */
  needsCount?: boolean;
};

const mttr = (y: Year) => y.hours / y.count;
const mtbf = (y: Year) => (y.plannedHours - y.hours) / y.count;
const avail = (y: Year) =>
  y.plannedHours > 0 ? ((y.plannedHours - y.hours) / y.plannedHours) * 100 : 100;

function metrics(rate: number | null): Metric[] {
  const all: Metric[] = [
    {
      id: 'hours',
      get: (y) => y.hours,
      show: (y) => h1(y.hours),
      lowerIsBetter: true,
      mark: 'more',
    },
    {
      id: 'count',
      get: (y) => y.count,
      show: (y) => String(y.count),
      lowerIsBetter: true,
      mark: 'more',
    },
    {
      id: 'mttr',
      get: mttr,
      show: (y) => h1(mttr(y)),
      lowerIsBetter: true,
      mark: 'slower',
      needsCount: true,
    },
    {
      id: 'mtbf',
      get: mtbf,
      show: (y) => `${Math.round(mtbf(y)).toLocaleString('en-IN')}${NBSP}h`,
      lowerIsBetter: false,
      mark: 'shorter',
      needsCount: true,
    },
    {
      id: 'avail',
      get: avail,
      show: (y) => `${avail(y).toFixed(2)}%`,
      lowerIsBetter: false,
      size: (v) => 100 - v,
      mark: 'downtime',
    },
  ];
  if (rate !== null) {
    all.push({
      id: 'money',
      get: (y) => y.hours * rate,
      show: (y) => lakh(y.hours * rate),
      lowerIsBetter: true,
      mark: 'more',
    });
  }
  return all;
}

/** One metric as both sides print it: the same id, label and hint, each side's figure and mark. */
function figureOf(
  m: Metric,
  ys: [Year, Year],
  rate: number | null,
  t: Words,
): [CompareFigure, CompareFigure] {
  const none = m.needsCount === true && (ys[0].count === 0 || ys[1].count === 0);
  const [va, vb] = [m.get(ys[0]), m.get(ys[1])];
  const size = m.size ?? ((v: number) => v);
  const r = none ? 1 : ratio(size(va), size(vb));
  const hint =
    m.id === 'money'
      ? t('v2cmp.fig.money.hint', { rate: `₹${NBSP}${rate?.toLocaleString('en-IN')}` })
      : t(`v2cmp.fig.${m.id}.hint`);
  const side = (y: Year, mine: number, other: number): CompareFigure => {
    const worse = m.lowerIsBetter ? mine > other : mine < other;
    const mark = none || r < SAME ? 'same' : worse ? 'worse' : 'better';
    const markText = none
      ? t('v2cmp.mark.none')
      : mark === 'same'
        ? t('v2cmp.mark.same')
        : mark === 'better'
          ? t('v2cmp.mark.better')
          : r === Infinity
            ? t('v2cmp.mark.worse')
            : t(`v2cmp.mark.${m.mark}`, { n: r.toFixed(1) });
    return {
      id: m.id,
      label: t(`v2cmp.fig.${m.id}.label`),
      hint,
      value: none ? '—' : m.show(y),
      mark,
      markText,
    };
  };
  return [side(ys[0], va, vb), side(ys[1], vb, va)];
}

/** Both boxes' figures in the same order, the biggest gap first. */
function figures(
  ys: [Year, Year],
  rate: number | null,
  t: Words,
): [CompareFigure[], CompareFigure[]] {
  const rows = metrics(rate).map((m) => {
    const size = m.size ?? ((v: number) => v);
    const none = m.needsCount === true && (ys[0].count === 0 || ys[1].count === 0);
    return {
      pair: figureOf(m, ys, rate, t),
      r: none ? 1 : ratio(size(m.get(ys[0])), size(m.get(ys[1]))),
    };
  });
  rows.sort((p, q) => q.r - p.r);
  return [rows.map((row) => row.pair[0]), rows.map((row) => row.pair[1])];
}

const causeOf = (y: Year, code: string) =>
  y.causes.find((c) => c.code === code) ?? { count: 0, hours: 0 };

/** The codes the pair differs most on, biggest gap in hours first. */
function topCodes(worse: Year, better: Year, n = 3): string[] {
  const names = new Set([...worse.causes, ...better.causes].map((c) => c.code));
  const gapOf = (c: string) => Math.abs(causeOf(worse, c).hours - causeOf(better, c).hours);
  return [...names].sort((x, y) => gapOf(y) - gapOf(x)).slice(0, n);
}

const codeName = (code: string, t: Words) => (code === '—' ? t('v2cmp.noCode') : code);
const causeText = (y: Year, code: string, t: Words) => {
  const c = causeOf(y, code);
  return t('v2cmp.causeText', { count: c.count, hours: c.hours.toFixed(1) });
};

function differencePoints(worse: Year, better: Year, t: Words): Point[] {
  return topCodes(worse, better).map((code) =>
    say(t('v2cmp.say.difference'), {
      cause: strong(codeName(code, t)),
      worseText: loss(causeText(worse, code, t)),
      worse: chip(worse.code),
      betterText: gain(causeText(better, code, t)),
      better: chip(better.code),
    }),
  );
}

function headline(worse: Year, better: Year, t: Words): Point {
  const r = ratio(worse.hours, better.hours);
  const [w, b] = [chip(worse.code), chip(better.code)];
  if (r < SAME)
    return say(t('v2cmp.say.headlineSame'), {
      worse: w,
      better: b,
      same: gain(t('v2cmp.sameHours')),
    });
  if (better.hours === 0)
    return say(t('v2cmp.say.headlineNone'), { worse: w, better: b, hours: loss(h1(worse.hours)) });
  return say(t('v2cmp.say.headline'), {
    worse: w,
    better: b,
    ratio: loss(t('v2cmp.ratio', { n: r.toFixed(1) })),
  });
}

function ageLine(worse: Year, better: Year, t: Words): Point[] {
  if (worse.age === null || better.age === null) return [];
  const diff = worse.age - better.age;
  if (Math.abs(diff) <= 2) {
    return [
      say(t('v2cmp.say.ageSame'), {
        ageWorse: strong(String(worse.age)),
        ageBetter: strong(String(better.age)),
      }),
    ];
  }
  const years = strong(t('v2cmp.years', { count: Math.abs(diff) }));
  return [
    say(t(diff > 0 ? 'v2cmp.say.older' : 'v2cmp.say.younger'), { worse: chip(worse.code), years }),
  ];
}

/** The answer first, then why: the shared ground, the hours, the biggest code and age. */
function verdictOf(worse: Year, better: Year, asOf: string, t: Words): VerdictData {
  const kind = strong(worse.category ?? '—');
  const [w, b] = [chip(worse.code), chip(better.code)];
  const why: Point[] =
    worse.cell === null || better.cell === null
      ? [say(t('v2cmp.say.kindNoCell'), { kind })]
      : [
          say(t('v2cmp.say.kind'), {
            kind,
            a: w,
            cellA: { text: worse.cell, entity: cellChip(worse.cell) },
            b,
            cellB: { text: better.cell, entity: cellChip(better.cell) },
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
    const share = Math.round(
      ((causeOf(worse, top).hours - causeOf(better, top).hours) / gap) * 100,
    );
    why.push(
      say(t('v2cmp.say.cause'), {
        cause: strong(codeName(top, t)),
        share: strong(`${share}%`),
        worseText: loss(causeText(worse, top, t)),
        betterText: gain(causeText(better, top, t)),
        worse: w,
        better: b,
      }),
    );
  }
  why.push(...ageLine(worse, better, t));
  return {
    context: t('v2cmp.context', { date: shortDate(asOf), category: worse.category ?? '—' }),
    headline: headline(worse, better, t),
    why,
  };
}

const change = (now: number, was: number, text: string) => ({
  text,
  up: now > was,
  good: now <= was,
});

/** How far apart the pair is, against how far apart the same two were last year. */
function kpisOf(worse: Year, better: Year, rate: number | null, t: Words): KpiData[] {
  const [gapH, lastH] = [worse.hours - better.hours, worse.last.hours - better.last.hours];
  const [gapN, lastN] = [worse.count - better.count, worse.last.count - better.last.count];
  const period = t('v2cmp.kpi.period');
  const out: KpiData[] = [
    {
      id: 'hours',
      label: t('v2cmp.kpi.hours.label'),
      icon: 'clock',
      value: h1(gapH),
      delta: change(gapH, lastH, `${sign(gapH - lastH)}${h1(Math.abs(gapH - lastH))}`),
      period,
      meaning: t('v2cmp.kpi.hours.meaning'),
      more:
        better.hours === 0
          ? ''
          : t('v2cmp.kpi.hours.more', { n: ratio(worse.hours, better.hours).toFixed(1) }),
    },
    {
      id: 'count',
      label: t('v2cmp.kpi.count.label'),
      icon: 'alert',
      value: String(gapN),
      delta: change(gapN, lastN, `${sign(gapN - lastN)}${Math.abs(gapN - lastN)}`),
      period,
      meaning: t('v2cmp.kpi.count.meaning'),
      more: t('v2cmp.kpi.count.more', { worse: worse.count, better: better.count }),
    },
  ];
  if (rate !== null) {
    const [gapR, lastR] = [gapH * rate, lastH * rate];
    out.push({
      id: 'money',
      label: t('v2cmp.kpi.money.label'),
      icon: 'rupee',
      value: lakh(gapR),
      delta: change(gapR, lastR, `${sign(gapR - lastR)}${lakh(Math.abs(gapR - lastR))}`),
      period,
      meaning: t('v2cmp.kpi.money.meaning'),
      more: t('v2cmp.kpi.money.more', { rate: `₹${NBSP}${rate.toLocaleString('en-IN')}` }),
    });
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
export function compareModel(reply: ComparedReply, page: Page, t: TFunction): CompareModel {
  const say_: Words = (key, values) => t(key, { ...values }) as string;
  const [a, b] = reply.years;
  const [worse, better] = a.hours >= b.hours ? [a, b] : [b, a];
  const [fa, fb] = figures(reply.years, reply.rate, say_);
  const sub = (y: Year) =>
    y.age === null
      ? say_('v2cmp.subNoAge', { kind: y.category ?? '—' })
      : say_('v2cmp.sub', { kind: y.category ?? '—', age: y.age });
  const words = pageWords(t, 'v2cmp.source');
  return {
    verdict: verdictOf(worse, better, reply.asOf, say_),
    pick: { ...reply.pair, options: reply.options.map((code) => ({ key: code, label: code })) },
    kpis: kpisOf(worse, better, reply.rate, say_),
    boxes: [
      { chip: machineChip(a.code), sub: sub(a), figures: fa },
      { chip: machineChip(b.code), sub: sub(b), figures: fb },
    ],
    differences: {
      title: say_('v2cmp.differences.title'),
      points: differencePoints(worse, better, say_),
      action: say_('v2cmp.differences.action'),
      doneText: say_('v2cmp.differences.done'),
      done: false,
    },
    trend: trendOf(worse, better, reply.asOf, say_),
    tables: { items: tablesOf(page.tables, words), words: words.table },
    source: say_('v2cmp.source', { date: shortDate(reply.asOf) }),
    words: { why: say_('v2cmp.why'), pickA: say_('v2cmp.pickA'), pickB: say_('v2cmp.pickB') },
  };
}
