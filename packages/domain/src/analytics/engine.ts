import type { AnalyticsProfile } from '@uptimo/shared';
import { COMPUTERS } from './computers.js';
import { FIGURES, type FigureDef } from './registry.js';
import type { Computed, Computer, EngineData, EngineResult, FigureResult } from './types.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The ids of the rows of each drill type, so a figure can be checked against the rows it was given. */
function knownIds(data: EngineData): Record<FigureDef['drill'], Set<string>> {
  return {
    machine: new Set(data.machines.map((row) => row.id)),
    ticket: new Set([...data.tickets, ...data.tasks].map((row) => row.id)),
    move: new Set(data.moves.map((row) => row.id)),
  };
}

/**
 * A computed figure must name rows (possibly none), and every one of them must be a row of its drill type in
 * the data it was computed from. A figure that cannot say where it came from is a bug in the engine, not a
 * value to show.
 */
function drillOf(def: FigureDef, computed: Computed, known: Set<string>): string[] {
  const ids = [...new Set(computed.drillIds)].sort();
  const stray = ids.find((id) => !known.has(id));
  if (stray !== undefined) {
    throw new Error(
      `Figure ${def.key} drills to ${stray}, which is not a ${def.drill} row of its data`,
    );
  }
  return ids;
}

/**
 * The engine with a given set of computations: the one test seam. Pure and deterministic: the same data, date
 * and profile always give the same figures, in registry order, and nothing reads the clock or the database.
 */
export function runWith(
  computers: Readonly<Record<string, Computer>>,
  input: { data: EngineData; asOf: string; profile: AnalyticsProfile },
): EngineResult {
  const { data, asOf, profile } = input;
  if (!DAY.test(asOf))
    throw new RangeError(`asOf must be a plant date like 2026-11-11, got ${asOf}`);
  const known = knownIds(data);
  const figures = FIGURES.map((def): FigureResult => {
    const base = { key: def.key, screen: def.screen, owner: def.owner };
    const compute = computers[def.key];
    if (!compute) {
      return { ...base, status: 'not_computed', value: null, drill: { type: def.drill, ids: [] } };
    }
    const computed = compute({ data, asOf, profile });
    const ids = drillOf(def, computed, known[def.drill]);
    return { ...base, status: 'ready', value: computed.value, drill: { type: def.drill, ids } };
  });
  const rows = {
    machines: data.machines.length,
    moves: data.moves.length,
    tickets: data.tickets.length,
    tasks: data.tasks.length,
    reports: data.reports.length,
    people: data.people.length,
  };
  return { asOf, profile, rows, figures };
}

/** `run(data, asOf, profile)`: the figures of the plant as of one plant date. */
export function run(data: EngineData, asOf: string, profile: AnalyticsProfile): EngineResult {
  return runWith(COMPUTERS, { data, asOf, profile });
}
