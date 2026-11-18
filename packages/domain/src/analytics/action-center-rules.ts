import {
  SEVERITY_WEIGHT,
  actionCenterContext,
  actionCenterKey,
  codeTitle,
  effectiveCell,
} from './action-center-model.js';
import type {
  ActionCenterNudge,
  ActionCenterRecord,
  ActionContext,
  ActionEntry,
} from './action-center-model.js';
import { amcNudges, legalNudges } from './action-center-ext.js';
import { humanNudges, shiftNudges, teamNudges, trendNudges } from './action-center-plant.js';
import { formatNumber } from './format.js';
import { isProduction, machineAge } from './machine-facts.js';
import { dayNumber, dmy } from './plant-date.js';
import type { ComputeInput } from './types.js';

/**
 * The Action Center's machine rules (ticket 44, packet 44a): recur, freq/rise, cell, long, mttr, newm, spares and
 * age. They read every CNC report (excluded machines included), because the platform raises these for an excluded
 * machine too. The plant-wide rules live in `action-center-plant.ts` and the AMC/legal reminders in
 * `action-center-ext.ts`; this file builds the whole list in the platform's order.
 */

const sumHours = (entries: readonly ActionEntry[]): number =>
  entries.reduce((total, entry) => total + entry.hours, 0);

/** Group entries by a key, dropping the ones a rule skips (a blank code or a NO-DT row). */
function groupEntries(
  entries: readonly ActionEntry[],
  keyOf: (entry: ActionEntry) => string | null,
): Map<string, ActionEntry[]> {
  const groups = new Map<string, ActionEntry[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (key !== null) groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return groups;
}

/** The distinct plant days a list of entries covers, oldest first. */
const distinctDays = (list: readonly ActionEntry[]): number[] =>
  [...new Set(list.map((entry) => entry.day))].sort((left, right) => left - right);

/** True when two of the days are consecutive (the recurring rule's high-severity test). */
const hasConsecutiveDays = (days: readonly number[]): boolean =>
  days.some((day, index) => index > 0 && day - days[index - 1]! === 1);

/** The same machine and code on two or more different days in the repeat window. */
function recurNudges(ctx: ActionContext): ActionCenterRecord[] {
  const { thresholds: c } = ctx;
  const groups = groupEntries(ctx.breakdownsIn(c.repeatDays), (entry) =>
    entry.code === '' || entry.noDt ? null : `${entry.machineId}|${entry.code}`,
  );
  const out: ActionCenterRecord[] = [];
  for (const [groupKey, list] of groups) {
    const days = distinctDays(list);
    if (days.length < c.repeatMinDays) continue;
    const [machineId = '', code = ''] = groupKey.split('|');
    out.push({
      key: actionCenterKey.recur(machineId, code),
      rule: 'recur',
      sev: days.length >= 3 || hasConsecutiveDays(days) ? 'high' : 'med',
      title: `${machineId}: ${codeTitle(ctx.data, code)} came back on ${days.length} different days in the last ${c.repeatDays} days`,
      machines: [machineId],
      entries: list.length,
      ev: ctx.latest(list)?.day ?? null,
    });
  }
  return out;
}

/** Frequent breakdowns, else a machine getting worse than the previous window. */
function frequencyNudges(ctx: ActionContext): ActionCenterRecord[] {
  const { thresholds: c } = ctx;
  const current = groupEntries(ctx.breakdownsIn(c.freqDays), (entry) => entry.machineId);
  const previous = groupEntries(
    ctx.breakdownsIn(c.freqDays, c.freqDays),
    (entry) => entry.machineId,
  );
  const out: ActionCenterRecord[] = [];
  for (const [machineId, list] of current) {
    const n = list.length;
    const before = previous.get(machineId)?.length ?? 0;
    const ev = ctx.latest(list)?.day ?? null;
    if (n >= c.freqMin) {
      out.push({
        key: actionCenterKey.freq(machineId),
        rule: 'freq',
        sev: n >= Math.ceil(c.freqMin * 1.5) ? 'high' : 'med',
        title: `${machineId} has broken down ${n} times in ${c.freqDays} days`,
        machines: [machineId],
        entries: n,
        ev,
      });
    } else if (n >= c.riseMin && n >= c.riseMult * Math.max(before, 1)) {
      out.push({
        key: actionCenterKey.rise(machineId),
        rule: 'rise',
        sev: 'med',
        title: `${machineId} is getting worse: ${n} breakdowns against ${before} before`,
        machines: [machineId],
        entries: n,
        ev,
      });
    }
  }
  return out;
}

/** The same code across one effective cell in the cell window. */
function cellNudges(ctx: ActionContext): ActionCenterRecord[] {
  const { thresholds: c } = ctx;
  const groups = groupEntries(ctx.breakdownsIn(c.cellDays), (entry) =>
    entry.code === '' || entry.noDt
      ? null
      : `${effectiveCell(entry, ctx.data.moves)}|${entry.code}`,
  );
  const out: ActionCenterRecord[] = [];
  for (const [groupKey, list] of groups) {
    const machineIds = [...new Set(list.map((entry) => entry.machineId))];
    if (list.length < c.cellMin || machineIds.length < 2) continue;
    const [cell = '', code = ''] = groupKey.split('|');
    out.push({
      key: actionCenterKey.cell(cell, code),
      rule: 'cell',
      sev: machineIds.length >= 4 ? 'high' : 'med',
      title: `Cell ${cell}: ${codeTitle(ctx.data, code)} on ${machineIds.length} machines (${list.length} breakdowns in ${c.cellDays} days)`,
      machines: machineIds,
      entries: list.length,
      ev: ctx.latest(list)?.day ?? null,
    });
  }
  return out;
}

/** A long breakdown in the long window with no saved Why-Why on its ticket. */
function longNudges(ctx: ActionContext): ActionCenterRecord[] {
  const saved = new Set((ctx.data.whyWhy ?? []).map((record) => record.ticketId));
  return ctx.breakdownsIn(ctx.thresholds.longDays).flatMap((entry) => {
    if (entry.hours <= ctx.whyWhyThresholdHours || saved.has(entry.ticketId)) return [];
    return [
      {
        key: actionCenterKey.long(entry.report.id),
        rule: 'long',
        sev: entry.hours >= 2 * ctx.whyWhyThresholdHours ? 'high' : 'med',
        title: `${entry.machineId}: ${formatNumber(entry.hours, 1)} hrs breakdown on ${dmy(entry.report.date)} has no root-cause analysis`,
        machines: [entry.machineId],
        entries: 1,
        ev: entry.day,
      },
    ];
  });
}

/** A machine whose repair average is the plant's multiple over the repair window. */
function mttrNudges(ctx: ActionContext): ActionCenterRecord[] {
  const { thresholds: c } = ctx;
  const rows = ctx.breakdownsIn(c.mttrDays).filter((entry) => entry.hours > 0);
  const fleet = ctx.productionBreakdownsIn(c.mttrDays).filter((entry) => entry.hours > 0);
  const fleetAvg = fleet.length === 0 ? 0 : sumHours(fleet) / fleet.length;
  const groups = groupEntries(rows, (entry) => entry.machineId);
  const out: ActionCenterRecord[] = [];
  for (const [machineId, list] of groups) {
    if (list.length < c.mttrMin) continue;
    const avg = sumHours(list) / list.length;
    if (fleetAvg <= 0 || avg < c.mttrMult * fleetAvg) continue;
    out.push({
      key: actionCenterKey.mttr(machineId),
      rule: 'mttr',
      sev: 'med',
      title: `${machineId}: repairs take ${formatNumber(avg, 2)} hrs on average, ${formatNumber(avg / fleetAvg, 1)}x the fleet average`,
      machines: [machineId],
      entries: list.length,
      ev: ctx.latest(list)?.day ?? null,
    });
  }
  return out;
}

/** A CNC machine bought inside the new-machine window with early breakdowns since purchase. */
function newMachineNudges(ctx: ActionContext): ActionCenterRecord[] {
  const { thresholds: c } = ctx;
  const out: ActionCenterRecord[] = [];
  for (const machine of ctx.data.machines) {
    if (machine.segment !== 'CNC' || machine.purchasedOn === null) continue;
    const bought = dayNumber(machine.purchasedOn.slice(0, 10));
    if (bought === null) continue;
    const age = ctx.asOfDay - bought;
    if (age < 0 || age > c.newMachDays) continue;
    const rows = ctx.entries.filter(
      (entry) => !entry.pm && entry.machineId === machine.id && entry.day >= bought,
    );
    if (rows.length < c.newMachMin) continue;
    out.push({
      key: actionCenterKey.newm(machine.id),
      rule: 'newm',
      sev: rows.length >= 4 ? 'high' : 'med',
      title: `New machine ${machine.id} (bought ${dmy(machine.purchasedOn)}) already has ${rows.length} breakdowns`,
      machines: [machine.id],
      entries: rows.length,
      ev: ctx.latest(rows)?.day ?? null,
    });
  }
  return out;
}

/** One machine's share of the spare cost in the spares window, on two or more cost rows. */
function sparesNudges(ctx: ActionContext): ActionCenterRecord[] {
  const { thresholds: c } = ctx;
  const costRows = ctx
    .breakdownsIn(c.spareDays)
    .filter((entry) => (entry.report.spareCost ?? 0) > 0);
  const groups = groupEntries(costRows, (entry) => entry.machineId);
  const total = costRows.reduce((sum, entry) => sum + (entry.report.spareCost ?? 0), 0);
  const out: ActionCenterRecord[] = [];
  for (const [machineId, list] of groups) {
    const cost = list.reduce((sum, entry) => sum + (entry.report.spareCost ?? 0), 0);
    if (total <= 0 || list.length < 2 || (cost / total) * 100 < c.spareShare) continue;
    out.push({
      key: actionCenterKey.spares(machineId),
      rule: 'spares',
      sev: 'med',
      title: `${machineId} used ${formatNumber((cost / total) * 100, 0)}% of all spares spend in the last ${c.spareDays} days`,
      machines: [machineId],
      entries: list.length,
      ev: ctx.latest(list)?.day ?? null,
    });
  }
  return out;
}

/** The old machines losing at least twice the fleet's hours per machine in the repair window. */
function ageNudges(ctx: ActionContext): ActionCenterRecord[] {
  const { thresholds: c } = ctx;
  const rows = ctx.productionBreakdownsIn(c.mttrDays);
  const hours = new Map<string, number>();
  for (const entry of rows)
    hours.set(entry.machineId, (hours.get(entry.machineId) ?? 0) + entry.hours);
  const fleet = ctx.data.machines.filter(isProduction);
  const total = [...hours.values()].reduce((sum, value) => sum + value, 0);
  const average = fleet.length === 0 ? 0 : total / fleet.length;
  if (average <= 0) return [];
  const old = fleet
    .filter((machine) => {
      const age = machineAge(machine, ctx.asOf);
      return age !== null && age >= c.oldAge && (hours.get(machine.id) ?? 0) >= 2 * average;
    })
    .sort((left, right) => (hours.get(right.id) ?? 0) - (hours.get(left.id) ?? 0));
  if (old.length === 0) return [];
  const oldIds = new Set(old.map((machine) => machine.id));
  return [
    {
      key: actionCenterKey.age(),
      rule: 'age',
      sev: 'low',
      title: `${old.length} machines aged ${c.oldAge}+ years lost at least twice the fleet average hours in the last ${c.mttrDays} days`,
      machines: old.slice(0, 5).map((machine) => machine.id),
      entries: rows.filter((entry) => oldIds.has(entry.machineId)).length,
      ev: ctx.latest(rows)?.day ?? null,
      agg: true,
    },
  ];
}

/** The 13 data rules in the platform's order. */
function dataRules(ctx: ActionContext): ActionCenterRecord[] {
  return [
    ...recurNudges(ctx),
    ...frequencyNudges(ctx),
    ...cellNudges(ctx),
    ...longNudges(ctx),
    ...trendNudges(ctx),
    ...mttrNudges(ctx),
    ...humanNudges(ctx),
    ...shiftNudges(ctx),
    ...teamNudges(ctx),
    ...newMachineNudges(ctx),
    ...sparesNudges(ctx),
    ...ageNudges(ctx),
  ];
}

/** The six fields the figure and the key hold: the internal evidence and flags stay in the model. */
function publicNudge(record: ActionCenterRecord): ActionCenterNudge {
  return {
    key: record.key,
    rule: record.rule,
    sev: record.sev,
    title: record.title,
    machines: record.machines,
    entries: record.entries,
  };
}

/**
 * The whole record list the figure and the board share, built in rule order and stably sorted by severity weight
 * (high 3, med 2, low 1, info 0) descending, then evidence day descending (a null evidence last). The sort is
 * stable, so a tie keeps rule order. The evidence day and the two risk flags are the internal fields a nudge's
 * status and the machine table read, so packet 44b reads this list rather than re-deriving them.
 */
export function actionCenterRecords(input: ComputeInput): ActionCenterRecord[] {
  const ctx = actionCenterContext(input);
  const records = [...dataRules(ctx), ...amcNudges(ctx), ...legalNudges(ctx)];
  records.sort(
    (left, right) =>
      SEVERITY_WEIGHT[right.sev] - SEVERITY_WEIGHT[left.sev] || (right.ev ?? 0) - (left.ev ?? 0),
  );
  return records;
}

/** The six fields the answer key and the figure hold: the internal evidence and flags stay in the model. */
export function actionCenterNudges(input: ComputeInput): ActionCenterNudge[] {
  return actionCenterRecords(input).map(publicNudge);
}
