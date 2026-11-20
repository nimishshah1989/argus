import type { EngineData } from '../../src/index.js';

/**
 * The orders a plant's rows can reach the engine in. The server sends the rows of each day `ORDER BY` the date and
 * then the row's UUID, so two plants holding the same records under different UUIDs hand over the same-day rows in
 * different orders. `loadedLikeTheServer` sorts a plant the way `loadEngineData` reads it. `shuffledWithinDays`
 * keeps the order of the days and puts each run of same-day rows in a seeded random order. The engine must give the
 * same figures for either, so neither a UUID nor the order of same-day rows may reach a figure.
 *
 * The machine list and the people keep their order: the list is the plant's own (the server sends it by code,
 * and codes are unique), a register prints its categories in the order the plant lists its machines, and a person's
 * code and printed name are made from the id, so a plant with other ids is a plant of other people.
 */

const by =
  <T>(...keys: ((row: T) => string)[]) =>
  (a: T, b: T): number => {
    for (const key of keys) {
      const [x, y] = [key(a), key(b)];
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  };

const sorted = <T>(rows: readonly T[], ...keys: ((row: T) => string)[]): T[] =>
  [...rows].sort(by(...keys));

/** The plant with its rows in the order the server's queries return them (machines and people as they are). */
export function loadedLikeTheServer(data: EngineData): EngineData {
  return {
    ...data,
    moves: sorted(
      data.moves,
      (row) => row.effectiveFrom,
      (row) => row.id,
    ),
    tickets: sorted(
      data.tickets,
      (row) => row.reportedAt,
      (row) => row.id,
    ),
    tasks: sorted(
      data.tasks,
      (row) => row.reportedAt,
      (row) => row.id,
    ),
    reports: sorted(
      data.reports,
      (row) => row.date,
      (row) => row.id,
    ),
  };
}

/** A small seeded generator, so a failing order can be run again. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A new array in a seeded random order (Fisher-Yates). */
function shuffle<T>(rows: readonly T[], next: () => number): T[] {
  const out = [...rows];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Each run of rows sharing a day, in a random order; the runs keep their place. */
function shuffleDays<T>(rows: readonly T[], day: (row: T) => string, next: () => number): T[] {
  const out: T[] = [];
  for (let start = 0; start < rows.length;) {
    let end = start + 1;
    while (end < rows.length && day(rows[end]!) === day(rows[start]!)) end++;
    out.push(...shuffle(rows.slice(start, end), next));
    start = end;
  }
  return out;
}

/** The plant with each day's rows in a random order, and every list without a day in a random order. */
export function shuffledWithinDays(data: EngineData, seed: number): EngineData {
  const next = random(seed);
  const mix = <T>(rows: readonly T[]): T[] => shuffle(rows, next);
  return {
    ...data,
    moves: shuffleDays(data.moves, (row) => row.effectiveFrom, next),
    tickets: shuffleDays(data.tickets, (row) => row.reportedAt, next),
    tasks: shuffleDays(data.tasks, (row) => row.reportedAt, next),
    reports: shuffleDays(data.reports, (row) => row.date, next),
    ...(data.whyWhy ? { whyWhy: mix(data.whyWhy) } : {}),
    ...(data.plantEvents
      ? { plantEvents: mix(data.plantEvents).map((e) => ({ ...e, lines: mix(e.lines) })) }
      : {}),
    ...(data.settings
      ? {
          settings: { ...data.settings, excludedMachineIds: mix(data.settings.excludedMachineIds) },
        }
      : {}),
  };
}
