import type { BottleneckCore } from './a9-bottleneck.js';
import { normalizeLabel } from './format.js';
import { dayNumber } from './plant-date.js';
import { effectiveHours, isNoDowntime } from './rows.js';
import { fleetRows } from './a9-forecast-sim.js';
import type { EngineData } from './types.js';

/**
 * A9's repeat faults (ticket 42, packet 42c): the entry-level half of the repeat table. An episode merges entries
 * on the same or the next day; a long-running fault is one merged episode on three or more days, and a recurring
 * fault is a greedy run of three code episodes whose first days span 30 days. A9's maintenance page prints them.
 */

const RF_WINDOW = 90;
const RF_LONG_DAYS = 3;
const RF_SPAN = 30;

interface RepeatEvent {
  day: number;
  hours: number;
  code: string;
  problem: string;
}

interface RepeatEpisode {
  first: number;
  last: number;
  hours: number;
  days: Set<number>;
  codes: Map<string, number>;
  problem: string;
}

/** One fault the maintenance table prints, before its code meaning and dates are written. */
export interface RepeatItem {
  type: 'Recurring' | 'Long-running';
  machineId: string;
  category: string;
  code: string;
  n: number;
  first: number;
  last: number;
  hours: number;
  problem: string;
}

/** The platform's episode merge, keeping the days and the codes a repeat fault reads. */
function mergeRepeat(events: readonly RepeatEvent[]): RepeatEpisode[] {
  const merged: RepeatEpisode[] = [];
  for (const event of [...events].sort((left, right) => left.day - right.day)) {
    const last = merged.at(-1);
    if (last !== undefined && event.day - last.last <= 1) {
      last.last = event.day;
      last.hours += event.hours;
      last.days.add(event.day);
      last.codes.set(event.code, (last.codes.get(event.code) ?? 0) + 1);
      if (event.problem !== '') last.problem = event.problem;
    } else {
      merged.push({
        first: event.day,
        last: event.day,
        hours: event.hours,
        days: new Set([event.day]),
        codes: new Map([[event.code, 1]]),
        problem: event.problem,
      });
    }
  }
  return merged;
}

/** Long-running: one merged episode on three or more days, its code the most frequent one it holds. */
function longRunning(
  machineId: string,
  category: string,
  events: readonly RepeatEvent[],
  winStart: number,
): RepeatItem[] {
  const items: RepeatItem[] = [];
  for (const episode of mergeRepeat(events)) {
    if (episode.days.size < RF_LONG_DAYS || episode.last < winStart) continue;
    const top = [...episode.codes.entries()].sort((left, right) => right[1] - left[1])[0];
    items.push({
      type: 'Long-running',
      machineId,
      category,
      code: top?.[0] ?? '—',
      n: episode.days.size,
      first: episode.first,
      last: episode.last,
      hours: episode.hours,
      problem: episode.problem,
    });
  }
  return items;
}

/** Recurring: a greedy run of three code episodes whose first days span 30 days, then skip the run. */
function recurring(
  machineId: string,
  category: string,
  events: readonly RepeatEvent[],
  winStart: number,
): RepeatItem[] {
  const byCode = new Map<string, RepeatEvent[]>();
  for (const event of events) {
    if (event.code === '—') continue;
    byCode.set(event.code, [...(byCode.get(event.code) ?? []), event]);
  }
  const items: RepeatItem[] = [];
  for (const [code, own] of byCode) {
    const episodes = mergeRepeat(own);
    let index = 0;
    while (index + 2 < episodes.length) {
      let end = index + 2;
      if (episodes[end]!.first - episodes[index]!.first > RF_SPAN) {
        index += 1;
        continue;
      }
      while (
        end + 1 < episodes.length &&
        episodes[end + 1]!.first - episodes[index]!.first <= RF_SPAN
      ) {
        end += 1;
      }
      const segment = episodes.slice(index, end + 1);
      const last = segment.at(-1)!;
      if (last.last >= winStart) {
        items.push({
          type: 'Recurring',
          machineId,
          category,
          code,
          n: segment.length,
          first: segment[0]!.first,
          last: last.last,
          hours: segment.reduce((total, episode) => total + episode.hours, 0),
          problem: last.problem,
        });
      }
      index = end + 1;
    }
  }
  return items;
}

/** Table 8's rows: the window's long-running episodes and recurring runs, biggest downtime first. */
export function repeatItems(data: EngineData, core: BottleneckCore): RepeatItem[] {
  const endDay = dayNumber(core.to) ?? 0;
  const winStart = endDay - RF_WINDOW;
  const byMachine = new Map<string, RepeatEvent[]>();
  for (const row of fleetRows(data)) {
    if (isNoDowntime(row)) continue;
    const day = dayNumber(row.report.date);
    if (day === null) continue;
    const list = byMachine.get(row.report.machineId) ?? [];
    list.push({
      day,
      hours: effectiveHours(row.report),
      code: (row.report.maintCode ?? '').trim() || '—',
      problem: String(row.report.problem ?? '').trim(),
    });
    byMachine.set(row.report.machineId, list);
  }
  const categories = new Map(
    core.fleet.map((risk) => [risk.machine.id, normalizeLabel(risk.machine.category ?? '')]),
  );
  const items: RepeatItem[] = [];
  for (const [machineId, events] of byMachine) {
    const category = categories.get(machineId) ?? '';
    items.push(
      ...longRunning(machineId, category, events, winStart),
      ...recurring(machineId, category, events, winStart),
    );
  }
  return items.sort((left, right) => right.hours - left.hours);
}
