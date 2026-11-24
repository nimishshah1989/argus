import {
  categoriesOf,
  categoryMttr,
  compareMachines,
  fitRates,
  historyRows,
  periodOf,
  referenceOf,
  scoreOf,
  statsOf,
  type Compared,
} from './compare-score.js';
import { comparePage } from './compare-pair.js';
import { isPm, type SourcedReport } from './rows.js';
import { pairYear, type PairYear } from './compare-year.js';
import type { ComputeInput, Computer, FigureValue } from './types.js';

/**
 * Compare Machines (ticket 43, packet 43a): the whole page the 11 November key prints, with no KPI, six tables and
 * two charts. It compares two machines of one category: the category with the most machines in the plant's CNC
 * list, then the first two of that category in the pane's default order (worst age-adjusted health first). The
 * arithmetic, the age-adjusted health score and the peer column live in `compare-score.ts`; the tables and charts
 * in `compare-pair.ts`; this file picks the pair and prints the page exactly as the platform's Compare page does.
 */

/** Two machines asked for by code (ADR 0021 §1). */
export type ComparePair = { a: string; b: string };

/**
 * The page for one pair (ticket 584): `page` — the pair, the codes the picker offers (machine A's category in the
 * engine's order: worst age-adjusted health first, then code), the page value `compareFigure` prints for that pair with
 * A as the first machine everywhere, its drill ids `[A's id, B's id]`, and each machine's year so far; `none` — the
 * plant has no comparison (the same cases `compareFigure` prints no page for; checked before the pair); `unknown` — the pair cannot be compared:
 * `a` when `a` is not a compare machine, `b` when `b` is not one, is the same machine, or is of another category.
 */
export type ComparePairResult =
  | {
      kind: 'page';
      pair: ComparePair;
      options: string[];
      value: FigureValue;
      drillIds: string[];
      years: [PairYear, PairYear];
    }
  | { kind: 'none' }
  | { kind: 'unknown'; field: 'a' | 'b' };

/**
 * Compare any two machines of one category (ADR 0021 §1). No `pair`: the engine's own pair, exactly as
 * `compareFigure` picks it. The category average column is machine A's category.
 */
export function comparePair(input: ComputeInput, pair?: ComparePair): ComparePairResult {
  const { data, asOf, profile } = input;
  const rows = historyRows(data);
  const scored = scoredOf(input, rows);
  const machines = compareMachines(data);
  const category = categoriesOf(machines)[0]?.name;
  if (scored === null || category === undefined) return { kind: 'none' };
  const first = orderedOf(scored, category);
  if (first.length < 2) return { kind: 'none' };
  const picked = pair ? pickPair(scored, pair) : { a: first[0], b: first[1], field: undefined };
  if (picked.field !== undefined) return { kind: 'unknown', field: picked.field };
  const { a, b } = picked;
  if (a === undefined || b === undefined) return { kind: 'none' };
  const ordered = pair ? orderedOf(scored, a.machine.category) : first;
  const reference = referenceOf(
    ordered.filter((row) => !row.machine.excludedFromProduction),
    true,
  );
  const page = comparePage(a, b, reference, asOf);
  const perDay = (profile.prodHrsPerDay * profile.workDaysPerYear) / 365;
  const yearOf = (row: Compared): PairYear =>
    pairYear(
      row.machine,
      rows.filter((r) => r.report.machineId === row.machine.id),
      asOf,
      perDay,
    );
  return {
    kind: 'page',
    pair: { a: a.machine.code, b: b.machine.code },
    options: ordered.map((row) => row.machine.code),
    value: { screen: 'compare', asOf, pages: [page] } as unknown as FigureValue,
    drillIds: [a.machine.id, b.machine.id],
    years: [yearOf(a), yearOf(b)],
  };
}

/** Machine A is a compare machine by code; B another of A's category. */
function pickPair(scored: readonly Compared[], pair: ComparePair) {
  const a = scored.find((row) => row.machine.code === pair.a);
  if (a === undefined) return { a, b: undefined, field: 'a' } as const;
  const b = scored.find(
    (row) =>
      row.machine.code === pair.b && row !== a && row.machine.category === a.machine.category,
  );
  return { a, b, field: b === undefined ? ('b' as const) : undefined };
}

/** One category's machines in the pane's default order: worst age-adjusted health first, then code. */
function orderedOf(scored: readonly Compared[], category: string | null): Compared[] {
  return scored
    .filter((row) => row.machine.category === category)
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.machine.code.localeCompare(right.machine.code, undefined, { numeric: true }),
    );
}

/** Every compare machine's stats and age-adjusted score; null when the plant has nothing to compare. */
function scoredOf({ data, profile }: ComputeInput, rows: SourcedReport[]): Compared[] | null {
  const machines = compareMachines(data);
  const period = periodOf(rows, data.gaps);
  if (period === null || machines.length < 2) return null;
  const perDay = (profile.prodHrsPerDay * profile.workDaysPerYear) / 365;
  const breakdowns = new Map<string, SourcedReport[]>();
  const pms = new Map<string, SourcedReport[]>();
  for (const row of rows) {
    const target = isPm(row) ? pms : breakdowns;
    target.set(row.report.machineId, [...(target.get(row.report.machineId) ?? []), row]);
  }
  const stats = machines.map((machine) =>
    statsOf(machine, breakdowns.get(machine.id) ?? [], pms.get(machine.id) ?? [], {
      period,
      perDay,
    }),
  );
  const fit = stats.filter((row) => !row.machine.excludedFromProduction && row.days > 0);
  if (fit.length === 0) return null;
  const fitN = fitRates(fit, 'n', 4);
  const fitH = fitRates(fit, 'h', 40);
  const context = {
    fitN,
    fitH,
    base: categoryMttr(fit),
    threshold: profile.whyWhyThresholdHours,
    end: period.end,
    noRecords: period.noRecords,
  };
  return stats.map((row) => scoreOf(row, context));
}

/** The Compare Machines figure. An empty plant or a category with no second machine prints no page. */
export const compareFigure: Computer = (input) => {
  const r = comparePair(input);
  return r.kind === 'page'
    ? { value: r.value, drillIds: r.drillIds }
    : { value: null, drillIds: [] };
};
