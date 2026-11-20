import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { MachineData } from '../../../ui/v2/domain/plant.js';
import type { Point } from '../../../ui/v2/points.js';
import type { TrendData } from '../../../ui/v2/trend-chart.js';
import { dashboardFixture } from '../dashboard/fixture.js';
import { glue, pt, pts } from '../dashboard/fixture-text.js';
import { factsOf, hoursText, nextOf, verdictOf } from './fixture-parts.js';
import {
  dateOf,
  LAST_MONTH,
  problemsOf,
  rawMachine,
  THIS_MONTH,
  type RawBreakdown,
  type RawMachine,
  type Who,
} from './fixture-rows.js';
import { machinePageWords, TAGS } from './fixture-words.js';
import type { BreakdownRow, MachinePageModel, PmData, SparesData, Tag } from './model.js';

/**
 * The Machine page's invented gallery data: any machine of the Dashboard's plant. Its rows are made from the
 * machine's own figures (rows.ts), and every figure printed here is added up from those rows, so the page, the plant
 * map and the machine drawer agree. An unknown code is nothing, which the page shows as "not found".
 */
const PEOPLE: Record<Who, { id: Who; label: string }> = {
  'neel-s': { id: 'neel-s', label: 'Neel S' },
  'arjun-v': { id: 'arjun-v', label: 'Arjun V' },
};
const machines = dashboardFixture.cells.flatMap((c) => c.machines);

const inDays = <R extends { days: number }>(rows: R[], lo: number, hi: number) =>
  rows.filter((r) => r.days >= lo && r.days <= hi);
const sum = (rows: { tenths: number }[]) => rows.reduce((s, r) => s + r.tenths, 0);

function storyOf(m: MachineData, b: RawBreakdown, repeat: boolean): Point[] {
  const info = problemsOf(m.code).find((p) => p.problem === b.problem)!;
  const who = PEOPLE[b.who];
  const person = `{{person:${who.id}|${who.label}}}`;
  if (b.open)
    return pts(
      `Down since this morning: **${b.problem}**`,
      `${person} is on it`,
      `Likely cause: ~~${info.cause}~~`,
    );
  return [
    ...pts(
      `**${b.problem}** on **${dateOf(b.days).shown}**, fixed by ${person} in !!${hoursText(b.tenths)}!!`,
      `Cause: ~~${info.cause}~~. Fix: ${info.fix}`,
    ),
    ...(repeat ? pts('The same problem **came back within 60 days**') : []),
    ...(b.waited ? pts(`Waited **${hoursText(b.waited)}** for the **${info.part}**`) : []),
  ];
}

function historyOf(m: MachineData, raw: RawMachine): BreakdownRow[] {
  return raw.breakdowns.map((b, i) => {
    const repeat = raw.breakdowns.some(
      (o) => o.problem === b.problem && o.days > b.days && o.days - b.days <= 60,
    );
    const waited = b.waited > 0;
    const tags: Tag[] = [
      ...(b.open ? [TAGS.open] : []),
      ...(repeat ? [TAGS.repeat] : []),
      ...(waited ? [TAGS.waited] : []),
    ];
    return {
      key: `bd-${m.code}-${i}`,
      days: b.days,
      date: dateOf(b.days),
      problem: b.problem,
      who: { kind: 'person', ...PEOPLE[b.who] },
      hours: { shown: hoursText(b.tenths), value: b.tenths / 10 },
      tags: tags.length ? tags : [TAGS.fixed],
      flags: { repeat, waited, open: b.open },
      story: storyOf(m, b, repeat),
    };
  });
}

/** Breakdown hours a week for the last 12 weeks, oldest first, each week from its Saturday to Friday. */
function trendOf(raw: RawMachine): TrendData {
  const weeks = Array.from({ length: 12 }, (_, w) => {
    const lo = 7 * (11 - w);
    return {
      label: dateOf(lo + 6).shown.slice(0, 6),
      tenths: sum(inDays(raw.breakdowns, lo, lo + 6)),
    };
  });
  const values = weeks.map((w) => w.tenths / 10);
  const peak = weeks.reduce((a, b) => (b.tenths > a.tenths ? b : a));
  return {
    title: 'Breakdown hours a week',
    sub: 'Hours a week · 12 weeks to 20-Nov-2026 · hover any week for its exact figure',
    aria: glue(
      `Breakdown hours a week for 12 weeks: ${(sum(weeks) / 10).toFixed(1)} h in all, most in the week from ${peak.label}`,
    ),
    categoryLabel: 'Week starting',
    valueLabel: '',
    categories: weeks.map((w) => w.label),
    series: [{ name: 'Breakdown', values, tone: 'danger' }],
  };
}

function delta(cur: number, prev: number, fmt: (n: number) => string, lowerIsBetter: boolean) {
  const d = Math.round((cur - prev) * 10) / 10;
  if (d === 0) return { text: 'no change', up: false, good: true, flat: true };
  return {
    text: glue(`${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}`),
    up: d > 0,
    good: lowerIsBetter ? d < 0 : d > 0,
  };
}
const h1 = (n: number) => `${n.toFixed(1)} h`;
const count = (n: number) => String(n);

function pmKpi(raw: RawMachine, nextPm: string): KpiData {
  const now = sum(inDays(raw.pm, 0, THIS_MONTH)) / 10;
  const oct = sum(inDays(raw.pm, ...LAST_MONTH)) / 10;
  return {
    id: 'pm',
    label: 'PM hours',
    icon: 'gauge',
    value: glue(h1(now)),
    delta: delta(now, oct, h1, false),
    period: 'vs Oct',
    meaning: 'Planned maintenance time this month',
    more: `Next PM ${nextPm}`,
  };
}

function kpisOf(raw: RawMachine, nextPm: string, weekly: number[]): KpiData[] {
  const b = raw.breakdowns;
  const now = inDays(b, 0, THIS_MONTH);
  const oct = inDays(b, ...LAST_MONTH);
  const q = inDays(b, 0, 89);
  const prevQ = inDays(b, 90, 179);
  const mean = (rows: { tenths: number }[]) => (rows.length ? sum(rows) / rows.length / 10 : 0);
  const longest = [...q].sort((a, c) => c.tenths - a.tenths)[0];
  return [
    {
      id: 'hours',
      label: 'Breakdown hours',
      icon: 'clock',
      value: glue(h1(sum(now) / 10)),
      delta: delta(sum(now) / 10, sum(oct) / 10, h1, true),
      period: 'vs Oct',
      meaning: 'Machine time lost to breakdowns this month',
      more: glue(`${now.length} breakdowns this month · ${h1(sum(oct) / 10)} in October`),
      trend: weekly,
    },
    {
      id: 'stops',
      label: 'Breakdowns',
      icon: 'alert',
      value: count(q.length),
      delta: delta(q.length, prevQ.length, count, true),
      period: 'vs the 90 days before',
      meaning: 'Times it stopped in the last 90 days',
      more: glue(`${prevQ.length} in the 90 days before`),
    },
    {
      id: 'mttr',
      label: 'Time to repair',
      icon: 'wrench',
      value: q.length ? glue(h1(mean(q))) : '–',
      delta:
        q.length && prevQ.length
          ? delta(mean(q), mean(prevQ), h1, true)
          : { text: 'no comparison', up: false, good: true, flat: true },
      period: 'vs the 90 days before',
      meaning: q.length
        ? 'Average from a stop to running again'
        : 'No breakdown in 90 days to measure',
      more: longest
        ? glue(`Longest: ${longest.problem}, ${hoursText(longest.tenths)}`)
        : 'Nothing to report',
    },
    pmKpi(raw, nextPm),
  ];
}

function pmOf(raw: RawMachine, nextPm: string, overdue: number, inPm: boolean): PmData {
  const done = raw.pm.filter((v) => v.onTime).length;
  return {
    figures: [
      {
        label: 'Next PM',
        value: nextPm,
        note: overdue ? `${overdue} days overdue` : 'Every quarter',
      },
      { label: 'PM hours this month', value: hoursText(sum(inDays(raw.pm, 0, THIS_MONTH))) },
      { label: 'Done on the day', value: `${done} of ${raw.pm.length}`, note: 'Last 12 months' },
    ],
    tag: overdue ? TAGS.overdue : inPm ? TAGS.inPm : TAGS.onTime,
    visits: raw.pm.map((v) =>
      pt(
        `**${dateOf(v.days).shown}** · ${v.days === 0 ? '~~in progress~~' : v.onTime ? '++done on the day++' : '~~done late~~'} · ${hoursText(v.tenths)}`,
      ),
    ),
  };
}

function sparesOf(m: MachineData, raw: RawMachine): SparesData {
  const used = problemsOf(m.code)
    .map((p) => ({ ...p, used: raw.breakdowns.filter((b) => b.problem === p.problem).length }))
    .filter((p) => p.used > 0)
    .sort((a, b) => b.used - a.used)
    .slice(0, 4);
  const out = used.filter((p) => raw.stock[p.part] === 0).length;
  const stock = (n: number) =>
    n === 0 ? '!!none in stock!!' : n === 1 ? '~~1 left~~' : `++${n} in stock++`;
  return {
    tag: out ? { ...TAGS.overdue, text: `${out} out of stock` } : TAGS.allStocked,
    parts: used.map((p) =>
      pt(
        `**${p.part}**: ${stock(raw.stock[p.part] ?? 0)}, used in **${p.used}** ${p.used === 1 ? 'breakdown' : 'breakdowns'}`,
      ),
    ),
  };
}

function build(m: MachineData): MachinePageModel {
  const raw = rawMachine(m);
  const nextPm = dateOf((raw.pm[0]?.days ?? 0) - 91).shown;
  const facts = factsOf(m, raw, nextPm);
  const trend = trendOf(raw);
  return {
    machine: m,
    verdict: verdictOf(m, facts),
    kpis: kpisOf(raw, nextPm, trend.series[0]!.values as number[]),
    next: nextOf(m, facts),
    trend,
    pm: pmOf(raw, nextPm, facts.overdueDays, m.state === 'pm'),
    spares: sparesOf(m, raw),
    history: historyOf(m, raw),
    source: dashboardFixture.source,
    words: machinePageWords,
  };
}

const models = new Map<string, MachinePageModel>();

/** The page's model for a machine of the invented plant; nothing for a code it does not have. */
export function machineFixture(id: string): MachinePageModel | null {
  const m = machines.find((x) => x.code === id);
  if (!m) return null;
  if (!models.has(id)) models.set(id, build(m));
  return models.get(id)!;
}
