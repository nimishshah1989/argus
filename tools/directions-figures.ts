import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PROFILE } from '../packages/shared/src/index.js';
import { run, type FigureResult } from '../packages/domain/src/index.js';
import { analyzeProblems } from '../packages/domain/src/analytics/problem-analysis.js';
import { ENGINE_DATA } from '../packages/domain/test/answer-key/fixture.js';

/**
 * The design preview's figures (ticket 80, packet 80g). The three directions print the plant's real figure shapes,
 * so this runs the engine's pure `run()` on the frozen answer key (11 Nov 2026) and keeps the screens the preview
 * draws: the dashboard, the machine page (one machine), the breakdown log and the four breakdown analyses. Every
 * drill id is dropped (each figure's own, and VC-28's nested breakdown, PM and move lists), so the machine's
 * breakdown list must be drawn from the log's rows or sample data. Every table is cut to 50 rows, so the file stays
 * small and holds only fixture data. The `showcase` figure (ticket 80t) adds the monthly series the analytics
 * overview draws, read from the same engine output.
 *
 *   pnpm tsx tools/directions-figures.ts           writes the snapshot
 *   pnpm tsx tools/directions-figures.ts --check   exits 1 when it is missing or stale
 */

const AS_OF = '2026-11-11';
const MACHINE = 'VC-28';
const MAX_ROWS = 50;
const KEEP_SCREENS = new Set(['dashboard']);
const KEEP_KEYS = new Set([
  'machine-page',
  'breakdown-log',
  'a1-bd-pm',
  'a2-category-cell',
  'a3-mttr-mtbf',
  'a10-problems',
]);
const SHOWCASE_CAUSES = 14;
const SHOWCASE_MACHINES = 10;
const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../apps/web/src/gallery/directions/generated/figures.json',
);

type Table = { title: string; header: string[]; rows: string[][] };
type Event = ReturnType<typeof analyzeProblems>['events'][number];
type Series = (number | null)[];

const valueOf = (figures: FigureResult[], key: string) => figures.find((f) => f.key === key)?.value;
const tablesOf = (figures: FigureResult[], key: string): Table[] =>
  (valueOf(figures, key) as { pages: { tables: Table[] }[] }).pages[0]!.tables;
const trendOf = (figures: FigureResult[]) =>
  (
    valueOf(figures, 'a1-bd-pm') as {
      pages: { charts: { id: string; datasets: { data: number[] }[] }[] }[];
    }
  ).pages[0]!.charts.find((c) => c.id === 'ch-a1-trend')!.datasets;
/** A printed cell (`1.24%`, `1,707.3`) as a number; a dash (a month with no records) is null. */
const num = (text: string | undefined): number | null =>
  text === undefined || text === '—' ? null : Number(text.replace(/[,%]/g, ''));
const r2 = (n: number): number => Math.round(n * 100) / 100;
const sum = (list: readonly Event[]): number => list.reduce((s, e) => s + e.hours, 0);
const byKey = (events: readonly Event[], key: (e: Event) => string): [string, number][] => {
  const out = new Map<string, number>();
  for (const e of events) out.set(key(e), (out.get(key(e)) ?? 0) + e.hours);
  return [...out].sort((a, b) => b[1] - a[1]);
};

/** A1's month-on-month table prints a cell's BD % row then its PM % row (the PM row has no label); the last pair is the plant. */
function percentSeries(figures: FigureResult[], months: number) {
  const rows = tablesOf(figures, 'a1-bd-pm')[1]!.rows;
  const pairs: { cell: string; bdPct: Series; pmPct: Series }[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    pairs.push({
      cell: rows[i]![0]!.replace('BD % / PM %', ''),
      bdPct: rows[i]!.slice(1, 1 + months).map(num),
      pmPct: rows[i + 1]!.slice(0, months).map(num),
    });
  }
  return { plant: pairs.pop()!, cells: pairs };
}

/** A3's plant row: MTTR with its label, then MTBF without one; the last column is the year. */
function reliabilitySeries(figures: FigureResult[], months: number) {
  const rows = tablesOf(figures, 'a3-mttr-mtbf')[2]!.rows;
  const at = rows.findIndex((r) => r[0]!.startsWith('PLANT TOTAL'));
  return {
    mttr: rows[at]!.slice(1, 1 + months).map(num),
    mtbf: rows[at + 1]!.slice(0, months).map(num),
    mttrYear: num(rows[at]!.at(-1)),
    mtbfYear: num(rows[at + 1]!.at(-1)),
  };
}

/** Per month: breakdown count, the cause and machine that lost the most hours, and the longest single breakdown. */
function monthDetail(list: readonly Event[]) {
  const cause = byKey(list, (e) => e.group)[0];
  const machine = byKey(list, (e) => e.machineId)[0];
  const longest = [...list].sort((a, b) => b.hours - a.hours)[0];
  return {
    breakdowns: list.length,
    topCause: cause && { name: cause[0], hours: r2(cause[1]) },
    worstMachine: machine && { id: machine[0], hours: r2(machine[1]) },
    longest: longest && {
      machine: longest.machineId,
      cause: longest.group,
      hours: r2(longest.hours),
      date: longest.date,
    },
  };
}

/**
 * The monthly series the analytics overview draws, taken from the engine's own figures (A1's month-on-month BD and
 * PM percent, A3's plant MTTR and MTBF) and from its problem analysis (one event per breakdown). Nothing is typed in:
 * a month without records is null, and months stop at the snapshot's month.
 */
function showcaseFigure(figures: FigureResult[]): FigureResult {
  const months = Number(AS_OF.slice(5, 7));
  const events = analyzeProblems(ENGINE_DATA).events;
  const byMonth = Array.from({ length: months }, (_, m) =>
    events.filter((e) => Number(e.date.slice(5, 7)) === m + 1),
  );
  const { plant, cells } = percentSeries(figures, months);
  const trend = trendOf(figures);
  const value = {
    asOf: AS_OF,
    months: tablesOf(figures, 'a1-bd-pm')[1]!.header.slice(1, 1 + months),
    plant: {
      bdPct: plant.bdPct,
      pmPct: plant.pmPct,
      ...reliabilitySeries(figures, months),
      bdHours: trend[0]!.data.slice(0, months).map(r2),
      pmHours: trend[1]!.data.slice(0, months).map(r2),
    },
    detail: byMonth.map(monthDetail),
    cells,
    totalHours: r2(sum(events)),
    causes: byKey(events, (e) => e.group)
      .slice(0, SHOWCASE_CAUSES)
      .map(([name, hours]) => {
        const own = events.filter((e) => e.group === name);
        const machines = byKey(own, (e) => e.machineId).slice(0, 4);
        return {
          name,
          hours: r2(hours),
          breakdowns: own.length,
          machines: machines.map(([id, h]) => ({ id, hours: r2(h) })),
        };
      }),
    heat: byKey(events, (e) => e.machineId)
      .slice(0, SHOWCASE_MACHINES)
      .map(([id]) => ({
        id,
        hours: byMonth.map((list) => r2(sum(list.filter((e) => e.machineId === id)))),
      })),
  };
  return {
    key: 'showcase',
    screen: 'showcase',
    owner: 80,
    status: 'ready',
    value,
    drill: { type: 'machine', ids: [] },
  } as unknown as FigureResult;
}

/** Every `rows` list (a table's body) cut to its first 50 rows, however deep it sits. */
function cut(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cut);
  if (typeof value !== 'object' || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] =
      key === 'rows' && Array.isArray(inner) ? inner.slice(0, MAX_ROWS).map(cut) : cut(inner);
  }
  return out;
}

/** The machine page's value holds all 192 machines; the preview draws one. */
function oneMachine(value: unknown): unknown {
  const byMachine = (value as { byMachine: Record<string, unknown> }).byMachine;
  const machine = byMachine[MACHINE];
  if (machine === undefined) throw new Error(`the answer key has no machine ${MACHINE}`);
  const record = machine as { drill: { breakdowns: string[]; pm: string[]; moves: string[] } };
  return { byMachine: { [MACHINE]: { ...record, drill: { breakdowns: [], pm: [], moves: [] } } } };
}

function keep(figure: FigureResult): FigureResult {
  const value = figure.key === 'machine-page' ? oneMachine(figure.value) : figure.value;
  return {
    ...figure,
    value: cut(value) as FigureResult['value'],
    drill: { ...figure.drill, ids: [] },
  };
}

function snapshot(): string {
  const result = run(ENGINE_DATA, AS_OF, DEFAULT_PROFILE);
  const figures = result.figures
    .filter((figure) => KEEP_SCREENS.has(figure.screen) || KEEP_KEYS.has(figure.key))
    .map(keep);
  figures.push(showcaseFigure(result.figures));
  return `${JSON.stringify({ asOf: result.asOf, figures })}\n`;
}

function main(): void {
  const fresh = snapshot();
  if (process.argv.includes('--check')) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
    if (current === fresh) return;
    console.error(
      `${current === null ? 'missing' : 'stale'}: run pnpm tsx tools/directions-figures.ts`,
    );
    process.exit(1);
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, fresh);
  console.log(`wrote ${OUT} (${Buffer.byteLength(fresh)} bytes)`);
}

main();
