import type { EngineData, MoveRow, ReportRow } from './types.js';

/**
 * The one order every computer reads a plant's same-day rows in. The loader sorts by a date and then by the row's
 * UUID, so two plants holding the same records but different UUIDs hand the engine the same-day rows in different
 * orders: a sum of floating values lands on another last decimal, a tie between equal rows breaks the other way and
 * a table lists its same-day rows swapped. `canonicalOrder` puts every run of rows that share a day (a report's
 * date, a ticket's instant, a move's effective date) in an order made of business keys only: the log number, the
 * shift, the machine's place in the plant's own list, the ticket's reference and the like. A database id is never a
 * key. Two rows equal in every key are the same row to a reader, so their order cannot show.
 *
 * The order of the days is the caller's: the loader sends them oldest first, and a fixture may send them as its
 * source did. The machine list keeps its order too: it is the plant's own listing (the server sends it by code, and
 * codes are unique), and a register that prints categories in the order the plant lists its machines reads it.
 */

type Key = string | number | null | undefined;

/** `null` and `undefined` sort after every value, so a row with no value for a key comes last. */
function compareKey(left: Key, right: Key): number {
  const leftNone = left === null || left === undefined;
  const rightNone = right === null || right === undefined;
  if (leftNone || rightNone) return Number(leftNone) - Number(rightNone);
  if (left === right) return 0;
  return left! < right! ? -1 : 1;
}

const compareKeys = (left: readonly Key[], right: readonly Key[]): number => {
  for (let i = 0; i < left.length; i++) {
    const found = compareKey(left[i], right[i]);
    if (found !== 0) return found;
  }
  return 0;
};

/** A copy of `rows` with each run of rows sharing a `day` ordered by `keys`; the runs stay where they are. */
function settleDays<T>(
  rows: readonly T[],
  day: (row: T) => string,
  keys: (row: T) => readonly Key[],
): T[] {
  const out: T[] = [];
  for (let start = 0; start < rows.length;) {
    let end = start + 1;
    while (end < rows.length && day(rows[end]!) === day(rows[start]!)) end++;
    const run = rows.slice(start, end).map((row) => ({ row, key: keys(row) }));
    run.sort((left, right) => compareKeys(left.key, right.key));
    for (const entry of run) out.push(entry.row);
    start = end;
  }
  return out;
}

/** A copy of `rows` ordered by `keys`, for a collection that has no day: a stable sort. */
export function settleAll<T>(rows: readonly T[], keys: (row: T) => readonly Key[]): T[] {
  return settleDays(rows, () => '', keys);
}

/** What orders two reports of one day when nothing but business values can: the log number, shift, machine, ticket. */
export function reportKeys(data: EngineData): (report: ReportRow) => readonly Key[] {
  const { machineAt, ticketRef } = lookups(data);
  return (report) => [
    report.srNo,
    report.shift,
    machineAt(report.machineId),
    ticketRef(report.ticketId),
    report.maintCode,
    report.problem,
    report.downtimeMin,
    report.recordedHours,
    report.category,
    report.rootCause,
  ];
}

/** What orders two moves of one day: the machine's place in the plant's list, then the cells and locations. */
export function moveKeys(data: EngineData): (move: MoveRow) => readonly Key[] {
  const { machineAt } = lookups(data);
  return (move) => [
    machineAt(move.machineId),
    move.fromCell,
    move.toCell,
    move.fromLocation,
    move.toLocation,
  ];
}

/** A machine's place in the plant's own list, and a ticket's reference, by id: the ids are only looked up, never ordered. */
function lookups(data: EngineData) {
  const place = new Map(data.machines.map((machine, index) => [machine.id, index]));
  const ref = new Map([...data.tickets, ...data.tasks].map((ticket) => [ticket.id, ticket.ref]));
  return {
    machineAt: (id: string | null): number =>
      id === null ? -1 : (place.get(id) ?? data.machines.length),
    ticketRef: (id: string | null): string => (id === null ? '' : (ref.get(id) ?? '')),
  };
}

/** The plant with every run of same-day rows in the canonical order; the input is not touched. */
export function canonicalOrder(data: EngineData): EngineData {
  const { machineAt, ticketRef } = lookups(data);
  return {
    ...data,
    moves: settleDays(data.moves, (move) => move.effectiveFrom, moveKeys(data)),
    tickets: settleDays(
      data.tickets,
      (ticket) => ticket.reportedAt,
      (ticket) => [ticket.ref],
    ),
    tasks: settleDays(
      data.tasks,
      (task) => task.reportedAt,
      (task) => [task.ref],
    ),
    reports: settleDays(data.reports, (report) => report.date, reportKeys(data)),
    ...(data.whyWhy
      ? {
          whyWhy: settleAll(data.whyWhy, (row) => [row.completedDate, ticketRef(row.ticketId)]),
        }
      : {}),
    ...(data.plantEvents
      ? {
          plantEvents: settleAll(data.plantEvents, (event) => [ticketRef(event.ticketId)]).map(
            (event) => ({
              ...event,
              lines: settleAll(event.lines, (line) => [machineAt(line.machineId)]),
            }),
          ),
        }
      : {}),
    ...(data.settings
      ? {
          settings: {
            ...data.settings,
            excludedMachineIds: settleAll(data.settings.excludedMachineIds, (id) => [
              machineAt(id),
            ]),
          },
        }
      : {}),
  };
}
