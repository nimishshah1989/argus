import { createHash } from 'node:crypto';
import {
  FIGURES,
  type EngineData,
  type EngineResult,
  type FigureResult,
} from '../packages/domain/src/index.js';

/**
 * The pure checks of `pnpm validate:full` (ticket 79, D34): an engine result and the data it ran on in, a list of
 * differences out. A difference carries a stable id (what the allowlist names) and a line of counts and figure keys:
 * never a name, never a row's text.
 */
export interface Diff {
  id: string;
  text: string;
}
export interface FigureRow {
  key: string;
  state: 'computed' | 'not computed yet';
  drill: number;
  identity: string;
}

/** The three money tiles the engine does not compute yet (ticket 46/47 bring them); no other figure may be missing. */
export const NOT_COMPUTED_YET: ReadonlySet<string> = new Set([
  'compare.spares-cost',
  'team-focus.cost',
  'action-center.spares-spend',
]);

/** A top-N list: the span picks its own top groups, so its drill rows differ by year and do not add up (by design). */
const TOP_N: ReadonlySet<string> = new Set(['dashboard.costliest-problems']);

const COUNT_KEYS = [
  ...['total-machines', 'utilities', 'dg-sets', 'cnc-machines', 'conventional-machines'],
  ...['process-machines', 'total-breakdowns'],
].map((name) => `dashboard.${name}`);
const HOUR_KEYS = ['total-downtime-hours', 'pm-hours', 'no-downtime-hours'].map(
  (name) => `dashboard.${name}`,
);

/** Keys in order, so a copy that went through `jsonb` (which reorders keys) hashes as the original does. */
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== 'object') return value;
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries.map(([key, item]) => [key, canonical(item)]));
};

export const hashOf = (value: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')
    .slice(0, 12);

const knownIds = (data: EngineData, type: FigureResult['drill']['type']): Set<string> =>
  new Set(
    type === 'machine'
      ? data.machines.map((row) => row.id)
      : type === 'move'
        ? data.moves.map((row) => row.id)
        : [...data.tickets, ...data.tasks].map((row) => row.id),
  );

type Identity = (figure: FigureResult, data: EngineData) => string | null;

const countIdentity: Identity = (figure) =>
  figure.value === figure.drill.ids.length
    ? null
    : `value ${String(figure.value)} but ${figure.drill.ids.length} rows`;

const hoursIdentity: Identity = (figure, data) => {
  const ids = new Set(figure.drill.ids);
  const minutes = data.reports
    .filter((report) => report.ticketId !== null && ids.has(report.ticketId))
    .reduce((sum, report) => sum + report.downtimeMin, 0);
  const hours = Math.round(minutes / 6) / 10;
  return figure.value === hours ? null : `value ${String(figure.value)} but rows sum ${hours}`;
};

const logIdentity: Identity = (figure) => {
  const value = figure.value as { pages?: { tables?: { rowCount?: number }[] }[] } | null;
  const shown = value?.pages?.[0]?.tables?.[0]?.rowCount ?? 0;
  return shown === figure.drill.ids.length
    ? null
    : `table ${shown} rows but ${figure.drill.ids.length} drill rows`;
};

/** The figures whose own number is a count or a sum of the rows they name; the others have no such identity. */
const IDENTITIES = new Map<string, Identity>([
  ...COUNT_KEYS.map((key): [string, Identity] => [key, countIdentity]),
  ...HOUR_KEYS.map((key): [string, Identity] => [key, hoursIdentity]),
  ['breakdown-log', logIdentity],
]);

/** A drill names only rows the data holds, each once. */
function rowProblems(figure: FigureResult, data: EngineData): string[] {
  const ids = figure.drill.ids;
  const known = knownIds(data, figure.drill.type);
  const stray = ids.filter((id) => !known.has(id)).length;
  const repeated = ids.length - new Set(ids).size;
  return [
    ...(stray > 0 ? [`${stray} drill ids not in the data`] : []),
    ...(repeated > 0 ? [`${repeated} drill ids repeated`] : []),
  ];
}

/** One figure: (a) it computes or is one of the three not-yet money tiles; (b) its drill rows are real and sum to it. */
function checkFigure(
  label: string,
  key: string,
  figure: FigureResult,
  data: EngineData,
): { row: FigureRow; diffs: Diff[] } {
  const computed = figure.status === 'ready';
  const diffs: Diff[] = [];
  if (!computed && !NOT_COMPUTED_YET.has(key)) {
    diffs.push({ id: `compute:${label}:${key}`, text: `${label} ${key}: not computed` });
  }
  const ids = figure.drill.ids;
  const identity = computed ? (IDENTITIES.get(key)?.(figure, data) ?? null) : null;
  const problems = [...rowProblems(figure, data), ...(identity === null ? [] : [identity])];
  if (problems.length > 0) {
    diffs.push({ id: `drill:${label}:${key}`, text: `${label} ${key}: ${problems.join('; ')}` });
  }
  const state = computed ? 'computed' : 'not computed yet';
  const shown = problems.length > 0 ? 'DIFF' : IDENTITIES.has(key) && computed ? 'ok' : 'n/a';
  return { row: { key, state, drill: ids.length, identity: shown }, diffs };
}

/** (a) and (b) over every registry figure of one run. */
export function checkRun(
  label: string,
  result: EngineResult,
  data: EngineData,
): { rows: FigureRow[]; diffs: Diff[] } {
  const byKey = new Map(result.figures.map((figure) => [figure.key, figure]));
  const checked = FIGURES.map((def) => {
    const figure = byKey.get(def.key);
    if (figure) return checkFigure(label, def.key, figure, data);
    return {
      row: undefined,
      diffs: [{ id: `compute:${label}:${def.key}`, text: `${label} ${def.key}: no result` }],
    };
  });
  return {
    rows: checked.flatMap((c) => (c.row ? [c.row] : [])),
    diffs: checked.flatMap((c) => c.diffs),
  };
}

/** (c) a second run (fresh load, fresh compute) gives the same figures, one hash per figure. */
export function checkStable(label: string, first: EngineResult, second: EngineResult): Diff[] {
  const again = new Map(second.figures.map((figure) => [figure.key, hashOf(figure)]));
  return first.figures
    .filter((figure) => again.get(figure.key) !== hashOf(figure))
    .map((figure) => ({
      id: `stable:${label}:${figure.key}`,
      text: `${label} ${figure.key}: a second run differs`,
    }));
}

const sumOf = (results: readonly EngineResult[], key: string): number =>
  results.reduce(
    (sum, result) => sum + Number(result.figures.find((f) => f.key === key)?.value),
    0,
  );

/**
 * (d) The span cut into years adds up to the whole span: for every ticket figure that reads the span, the years' drill
 * rows do not overlap and their union is the whole span's; the breakdown count and the hour totals add up too.
 */
export function checkYears(whole: EngineResult, years: readonly EngineResult[]): Diff[] {
  const diffs: Diff[] = [];
  for (const def of FIGURES.filter(
    (d) => d.reads === undefined && d.drill === 'ticket' && !TOP_N.has(d.key),
  )) {
    const all = years.flatMap((r) => r.figures.find((f) => f.key === def.key)?.drill.ids ?? []);
    const union = new Set(all);
    const target = new Set(whole.figures.find((f) => f.key === def.key)?.drill.ids ?? []);
    const missing = [...target].filter((id) => !union.has(id)).length;
    const extra = [...union].filter((id) => !target.has(id)).length;
    const overlap = all.length - union.size;
    if (missing + extra + overlap > 0) {
      diffs.push({
        id: `years:${def.key}`,
        text: `${def.key}: years vs whole span: ${missing} rows missing, ${extra} extra, ${overlap} in two years`,
      });
    }
  }
  const total = (key: string, slack: number): string | null => {
    const parts = sumOf(years, key);
    const whole1 = sumOf([whole], key);
    return Math.abs(parts - whole1) <= slack
      ? null
      : `${key}: years add to ${parts}, whole span ${whole1}`;
  };
  const sums = [
    total('dashboard.total-breakdowns', 0),
    ...HOUR_KEYS.map((key) => total(key, 0.05 * years.length + 1e-6)),
  ];
  for (const text of sums.filter((s) => s !== null)) {
    diffs.push({ id: `years:${text.split(':')[0]}:sum`, text });
  }
  return diffs;
}

/**
 * (e) Every ticket in the database is read by at least one figure: `inDatabase` counts the ticket table, the loader's
 * own rows must equal it, and the unread are listed by ref (never text).
 */
export function checkCoverage(
  data: EngineData,
  whole: EngineResult,
  inDatabase: number,
): { read: number; total: number; diffs: Diff[] } {
  const tickets = [...data.tickets, ...data.tasks];
  const read = new Set(
    whole.figures.filter((f) => f.drill.type === 'ticket').flatMap((f) => f.drill.ids),
  );
  const unread = tickets.filter((ticket) => !read.has(ticket.id));
  const diffs = unread.map((ticket) => ({
    id: `coverage:${ticket.ref}`,
    text: `ticket ${ticket.ref} (${ticket.kind}) is read by no figure`,
  }));
  if (tickets.length !== inDatabase) {
    diffs.unshift({
      id: 'coverage:loader',
      text: `the loader read ${tickets.length} tickets, the database holds ${inDatabase}`,
    });
  }
  return { read: tickets.length - unread.length, total: inDatabase, diffs };
}

/** The allowlist file: `- <id> - <cause>` lines; an id ending in `*` names every difference that starts with it. */
export function parseAllowlist(markdown: string): { id: string; cause: string }[] {
  return markdown.split('\n').flatMap((line) => {
    const match = /^- (\S+)\s+[-–—:]\s+(\S.*)$/.exec(line.trim());
    return match ? [{ id: match[1]!, cause: match[2]! }] : [];
  });
}

export function explainedBy(
  diff: Diff,
  allow: readonly { id: string; cause: string }[],
): string | null {
  const hit = allow.find((a) =>
    a.id.endsWith('*') ? diff.id.startsWith(a.id.slice(0, -1)) : a.id === diff.id,
  );
  return hit ? hit.cause : null;
}
