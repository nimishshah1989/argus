import { actionCenterKey } from './action-center-model.js';
import type { ActionCenterRecord, ActionContext, ActionEntry } from './action-center-model.js';
import { formatNumber } from './format.js';

/**
 * The Action Center's plant-wide rules (ticket 44, packet 44a): the latest week's trend, the human-mistake code,
 * one shift's share and one person's workload. These read the production fleet only (CNC machines the plant counts
 * in production data); the machine rules in `action-center-rules.ts` also raise nudges for excluded machines.
 */

const sumHours = (entries: readonly ActionEntry[]): number =>
  entries.reduce((total, entry) => total + entry.hours, 0);

/** The plant's top machines by hours in a window, biggest first (the spike's contributors). */
function topByHours(entries: readonly ActionEntry[], limit: number): string[] {
  const hours = new Map<string, number>();
  for (const entry of entries)
    hours.set(entry.machineId, (hours.get(entry.machineId) ?? 0) + entry.hours);
  return [...hours.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([machineId]) => machineId);
}

/** The plant's first test: the week is over the four-week average by the profile's rise and least hours. */
function isSpike(h7: number, hp: number, ctx: ActionContext): boolean {
  return (
    hp > 0 && h7 >= hp * (1 + ctx.thresholds.spikePct / 100) && h7 >= ctx.thresholds.spikeMinHrs
  );
}

/** The plant's second test: the log is fresh and the week is well under the four-week average. */
function isQuietWeek(h7: number, hp: number, ctx: ActionContext): boolean {
  const fresh = ctx.lastEntryDay !== null && ctx.asOfDay - ctx.lastEntryDay <= 2;
  return fresh && hp >= ctx.thresholds.spikeMinHrs && h7 <= hp * 0.6;
}

/** The latest week against the weekly average of the four weeks before, or good news on a quiet week. */
export function trendNudges(ctx: ActionContext): ActionCenterRecord[] {
  const week = ctx.productionBreakdownsIn(7);
  const before = ctx.productionBreakdownsIn(28, 7);
  const h7 = sumHours(week);
  const hp = sumHours(before) / 4;
  const n7 = week.length;
  if (isSpike(h7, hp, ctx)) {
    return [
      {
        key: actionCenterKey.spike(),
        rule: 'spike',
        sev: h7 >= hp * 2 ? 'high' : 'med',
        title: `Downtime this week is ${formatNumber((h7 / hp - 1) * 100, 0)}% above the recent weekly average`,
        machines: topByHours(week, 3),
        entries: n7,
        ev: ctx.latest(week)?.day ?? null,
      },
    ];
  }
  if (isQuietWeek(h7, hp, ctx)) {
    return [
      {
        key: actionCenterKey.good(),
        rule: 'good',
        sev: 'info',
        title: `Downtime this week is ${formatNumber((1 - h7 / hp) * 100, 0)}% below the recent weekly average`,
        machines: [],
        entries: n7,
        ev: ctx.latest(week)?.day ?? ctx.asOfDay,
      },
    ];
  }
  return [];
}

/** The HUM code's share of the last 30 days' production breakdowns. */
export function humanNudges(ctx: ActionContext): ActionCenterRecord[] {
  const { thresholds: c } = ctx;
  const month = ctx.productionBreakdownsIn(30);
  if (month.length < 10) return [];
  const human = month.filter((entry) => entry.upperCode === 'HUM');
  const share = (human.length / month.length) * 100;
  if (share < c.humShare) return [];
  const counts = new Map<string, number>();
  for (const entry of human) counts.set(entry.machineId, (counts.get(entry.machineId) ?? 0) + 1);
  const machines = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([machineId]) => machineId);
  return [
    {
      key: actionCenterKey.hum(),
      rule: 'hum',
      sev: share >= 2 * c.humShare ? 'high' : 'med',
      title: `Human mistakes caused ${formatNumber(share, 0)}% of breakdowns in the last 30 days (${human.length} of ${month.length})`,
      machines,
      entries: human.length,
      ev: ctx.latest(human)?.day ?? null,
      agg: true,
    },
  ];
}

/** One shift's share of the last 30 days' production breakdowns. */
export function shiftNudges(ctx: ActionContext): ActionCenterRecord[] {
  const { thresholds: c } = ctx;
  const month = ctx.productionBreakdownsIn(30);
  if (month.length < 20) return [];
  const counts = new Map<string, number>();
  for (const entry of month) {
    const shift = entry.report.shift === '' ? '?' : entry.report.shift;
    counts.set(shift, (counts.get(shift) ?? 0) + 1);
  }
  if (counts.size <= 1) return [];
  const top = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  if (top === undefined || (top[1] / month.length) * 100 < c.shiftShare) return [];
  return [
    {
      key: actionCenterKey.shift(top[0]),
      rule: 'shift',
      sev: 'low',
      title: `Shift ${top[0]} had ${formatNumber((top[1] / month.length) * 100, 0)}% of breakdowns in the last 30 days`,
      machines: [],
      entries: top[1],
      ev: ctx.latest(month)?.day ?? null,
      agg: true,
    },
  ];
}

/** The Settings-team member named in Done By on the largest share of the last 30 days. */
export function teamNudges(ctx: ActionContext): ActionCenterRecord[] {
  const { thresholds: c } = ctx;
  const month = ctx.productionBreakdownsIn(30);
  if (month.length < 10) return [];
  let best = { code: '', count: 0 };
  for (const code of ctx.data.settings?.teamCodes ?? []) {
    const count = month.filter((entry) => entry.report.doneBy.includes(code)).length;
    if (count > best.count) best = { code, count };
  }
  if (best.code === '' || (best.count / month.length) * 100 < c.teamShare) return [];
  const name =
    ctx.data.people.find((person) => person.code === best.code)?.displayName ?? best.code;
  return [
    {
      key: actionCenterKey.team(name),
      rule: 'team',
      sev: 'low',
      title: `${name} attended ${formatNumber((best.count / month.length) * 100, 0)}% of breakdowns in the last 30 days`,
      machines: [],
      entries: best.count,
      ev: ctx.latest(month)?.day ?? null,
      agg: true,
    },
  ];
}
