import type { DecisionData } from '../../../ui/v2/domain/decision-row.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import { chip as machineChip, glue, pt, pts } from '../dashboard/fixture-text.js';
import { dashboardFixture } from '../dashboard/fixture.js';
import { LANES, LAST_MONTH, STATUS, type Raw } from './fixture-actions.js';
import {
  chipOf,
  hoursText,
  isOpen,
  lakhYear,
  mark,
  nameOf,
  sum,
  type PEOPLE,
} from './fixture-load.js';
import type { ActionRow, PersonLoad } from './model.js';

const machines = new Map(dashboardFixture.cells.flatMap((c) => c.machines).map((m) => [m.code, m]));
export const stopsOf = (code: string) => machines.get(code)?.stops ?? 0;

/** The days of the last 90 on which a machine stopped: as many as it has stops, spread out, oldest first. */
const daysOf = (stops: number) =>
  Array.from({ length: stops }, (_, i) =>
    Math.min(89, Math.floor(((i + 1) * 90) / (stops + 1)) + ((i * 3) % 5)),
  );

const signed = (n: number, unit = '') => glue(`${n < 0 ? '−' : '+'}${Math.abs(n)}${unit}`);
const pct = (part: number, whole: number) => Math.round((part / whole) * 100);

/** The open actions nobody owns, biggest first, each ending in the person the engine suggests. */
export function startList(
  raw: Raw[],
  suggested: Map<string, (typeof PEOPLE)[number]>,
  people: PersonLoad[],
): DecisionData[] {
  const openTenths = sum(raw.filter(isOpen));
  return raw
    .filter((r) => isOpen(r) && r.owner === null)
    .sort((a, b) => b.tenths - a.tenths)
    .map((r) => {
      const who = suggested.get(r.id)!;
      const first = r.codes[0]!;
      const stops = stopsOf(first);
      const share = pct(r.tenths, openTenths);
      const why = pts(
        `{{machine:${first}|${first}}} had !!${stops} breakdowns!! in the last 90 days`,
        `Nobody owns it: **${share}%** of the open hours wait on a name`,
      );
      const room = people.find((p) => p.chip.id === who)!.open;
      return {
        id: r.id,
        kind: LANES[r.lane].kind,
        kindLabel: LANES[r.lane].label,
        codes: r.codes.map(machineChip),
        title: r.title,
        keys: [
          { text: 'No owner', tone: 'risk' as const },
          { text: `${share}% of open hours`, tone: 'loss' as const },
        ],
        why,
        detail: [...why, pt(`${mark(who)} has the most room: **${room} open** now`)],
        hours: hoursText(r.tenths),
        money: `${lakhYear(r.tenths)} a year`,
        days: daysOf(stops),
        stripLabel: `${stops} breakdowns in the last 90 days`,
        action: `Assign to ${nameOf(who)}`,
        doneText: `Assigned to ${nameOf(who)}`,
        owner: pt(`Suggested: ${mark(who)}`),
        decided: false,
      };
    });
}

/** Every action of the month as the full list prints it. */
export function actionRows(raw: Raw[]): ActionRow[] {
  return raw.map((r) => ({
    id: r.id,
    kind: LANES[r.lane].kind,
    kindLabel: LANES[r.lane].label,
    title: r.title,
    chips: r.codes.map(machineChip),
    owner: r.owner === null ? null : chipOf(r.owner),
    status: r.status,
    statusLabel: STATUS[r.status],
    hours: { shown: hoursText(r.tenths), value: r.tenths / 10 },
  }));
}

/** Closed actions by the end of each week of the month: done or not needed, added up. */
export const closedByWeek = (raw: Raw[]) =>
  [1, 2, 3, 4].map((w) => raw.filter((r) => (r.week ?? 99) <= w).length);

/** A change against last month: signed, its direction, and whether that direction is good (`lowerIsBetter`). */
const change = (now: number, was: number, text: string, lowerIsBetter: boolean) => ({
  text,
  up: now > was,
  good: lowerIsBetter ? now <= was : now >= was,
});

type Facts = ReturnType<typeof facts>;
function facts(raw: Raw[]) {
  const open = raw.filter(isOpen);
  const unowned = open.filter((r) => r.owner === null);
  const closed = raw.length - open.length;
  const count = (status: string) => raw.filter((r) => r.status === status).length;
  return {
    raw,
    open,
    unowned,
    stake: sum(open),
    doing: count('doing'),
    done: count('done'),
    skipped: count('skip'),
    progress: pct(closed, raw.length),
    biggest: [...unowned].sort((a, b) => b.tenths - a.tenths)[0],
  };
}

const openKpi = (f: Facts): KpiData => ({
  id: 'open',
  label: 'Open actions',
  icon: 'list',
  value: String(f.open.length),
  delta: change(f.open.length, LAST_MONTH.open, signed(f.open.length - LAST_MONTH.open), true),
  period: 'vs Oct',
  meaning: 'Planned work not yet done',
  more: `${f.doing} started, ${f.open.length - f.doing} not started`,
  trend: closedByWeek(f.raw).map((c) => f.raw.length - c),
});

const stakeKpi = (f: Facts): KpiData => ({
  id: 'stake',
  label: 'At stake a month',
  icon: 'clock',
  value: hoursText(f.stake),
  delta: change(
    f.stake,
    LAST_MONTH.stakeTenths,
    signed((f.stake - LAST_MONTH.stakeTenths) / 10, ' h'),
    true,
  ),
  period: 'vs Oct',
  meaning: 'Breakdown hours the open actions win back',
  more: `${lakhYear(f.stake, 1)} a year at ₹ 3,329 an hour`,
});

const unownedKpi = (f: Facts): KpiData => ({
  id: 'unowned',
  label: 'No owner yet',
  icon: 'person',
  value: String(f.unowned.length),
  delta: change(
    f.unowned.length,
    LAST_MONTH.unowned,
    signed(f.unowned.length - LAST_MONTH.unowned),
    true,
  ),
  period: 'vs Oct',
  meaning: 'Open actions nobody has taken',
  more: f.biggest ? `The biggest: ${f.biggest.title}` : 'Every open action has an owner',
});

const progressKpi = (f: Facts): KpiData => ({
  id: 'progress',
  label: 'Done',
  icon: 'check',
  value: `${f.progress}%`,
  delta: change(
    f.progress,
    LAST_MONTH.progress,
    signed(f.progress - LAST_MONTH.progress, ' pts'),
    false,
  ),
  period: 'vs Oct',
  meaning: 'Share of the month’s actions done or not needed',
  more: `${f.done} done, ${f.skipped} not needed`,
  trend: closedByWeek(f.raw).map((c) => pct(c, f.raw.length)),
});

/** The four key figures: open work, what it is worth, what nobody owns, how much is closed. */
export const kpis = (raw: Raw[]): KpiData[] => {
  const f = facts(raw);
  return [openKpi(f), stakeKpi(f), unownedKpi(f), progressKpi(f)];
};

/** The answer first: what is open and worth, who is over the line, how much is done. */
export function verdict(raw: Raw[], people: PersonLoad[]): VerdictData {
  const open = raw.filter(isOpen);
  const unowned = open.filter((r) => r.owner === null);
  const over = people.find((p) => p.load === 'over');
  const closed = raw.length - open.length;
  const biggest = [...open].sort((a, b) => b.tenths - a.tenths)[0]!;
  return {
    context: 'Friday 20-Nov-2026 · the month’s plan · whole plant',
    headline: pt(
      `${open.length} open actions put !!${lakhYear(sum(open), 1)} a year!! at stake, and !!${unowned.length} have no owner!!.`,
    ),
    why: [
      pt(
        `**${unowned.length} of ${open.length}** open actions have no owner: !!${hoursText(sum(unowned))} a month!! waits for a name`,
      ),
      over
        ? pt(
            `${mark(over.chip.id)} carries **${over.open} of ${open.length}**, the only one over the line`,
          )
        : pt('Nobody is over the line'),
      pt(
        `**${closed} of ${raw.length}** are done or not needed: ++${pct(closed, raw.length)}%++, up from ${LAST_MONTH.progress}% in October`,
      ),
      pt(`The biggest still open: **${biggest.title}**, ${hoursText(biggest.tenths)} a month`),
    ],
  };
}
