import { pathToFileURL } from 'node:url';
import { classifyLegacy, type ClassifiedRow } from '../apps/server/src/seed/legacy-classify.js';
import { convertLegacy } from '../apps/server/src/seed/legacy-export.js';
import {
  connect,
  engineData,
  figureOf,
  loadLegacyYears,
  type LoadedYear,
  workbookYears,
  runYear,
} from '../apps/server/src/seed/legacy-load.js';
import { foldMachine } from '../apps/server/src/seed/legacy-sheets.js';
import { readWorkbook } from './answer-key/xlsx.js';
import {
  findWorkbooks,
  formatReport,
  loadPlant,
  parseArgs,
  parseSwitches,
  readAll,
} from './import-legacy.js';
import {
  compare,
  formatDifference,
  loadedFigures,
  parseSummary,
  type Difference,
} from './legacy-check.js';
import { explain } from './legacy-explain.js';

/**
 * `pnpm exec tsx tools/load-legacy.ts --data <folder> --tenant <slug> [--plant <file>] [--star ..] [--retired ..]
 * [--gap ..] [--fold ..] [--allow-remote]` (ticket 69c). Converts the workbooks as `pnpm import:legacy` does, adds the list entries the
 * old history names, loads each year in order through the importer into the database on `DATABASE_URL`, runs the
 * engine once per year and sets each workbook's MTTR and MTBF sheets against what was loaded. DATABASE_URL must be the app role and a
 * local host (`--allow-remote` lifts the host rule for 69d); the printed lines carry counts and machine codes, never a row's text.
 */
const USAGE =
  'usage: load-legacy --data <folder> --tenant <slug> [--plant <file>] [--star|--retired|--gap|--fold ..] [--allow-remote]';

function split(argv: readonly string[]): { tenant: string; allowRemote: boolean; rest: string[] } {
  const at = argv.indexOf('--tenant');
  const tenant = at < 0 ? undefined : argv[at + 1];
  if (!tenant) throw new Error(USAGE);
  const rest = argv.filter((a, i) => i !== at && i !== at + 1 && a !== '--allow-remote');
  return { tenant, allowRemote: argv.includes('--allow-remote'), rest };
}

export interface LoadResult {
  loaded: LoadedYear[];
  /** Machine-months on the summary sheets that differ from the loaded plant. */
  named: number;
  /** Of those, the ones no counting rule of the sheet reproduces: goal 5 needs 0. */
  unexplained: number;
}

type Plant = ReturnType<typeof loadPlant>;
type Files = ReturnType<typeof convertLegacy>['files'];
type PlantData = Awaited<ReturnType<typeof engineData>>;

/** The workbooks to one file per year, each report printed; nothing is loaded if an identity is broken. */
function convert(
  data: string,
  plant: Plant,
  args: Map<string, string>,
): { files: Files; classified: ClassifiedRow[] } {
  const switches = parseSwitches(args);
  console.log(`switches: ${JSON.stringify(switches)}`);
  const { rows, sheets } = readAll(data, plant.machines);
  const { files, reports } = convertLegacy(rows, plant, switches);
  for (const report of reports) {
    console.log(formatReport(report, sheets.get(report.year) ?? []).join('\n'));
  }
  if (files.length === 0) throw new Error('no workbook with a year in its name was found');
  if (reports.some((report) => !report.identity))
    throw new Error('the identity is broken; nothing loaded');
  return { files, classified: classifyLegacy(rows, plant.machines, switches).rows };
}

/** The engine once per year with an explicit period: the breakdown count and the months with no records. */
function printEngine(plantData: PlantData, years: readonly number[]): void {
  for (const year of years) {
    const result = runYear(plantData, year);
    const none = result.period?.noRecords ?? [];
    const value = (key: string): string => JSON.stringify(figureOf(result, key));
    console.log(
      `engine ${year}: breakdowns ${value('dashboard.total-breakdowns')} | downtime hours ${value('dashboard.total-downtime-hours')}` +
        ` | fleet availability ${value('dashboard.fleet-availability')} | no records: ${none.join(' ') || '-'}`,
    );
  }
}

/** The log's rows of a machine in a month or quarter of one workbook year, every class, for the explanation. */
function rowsOf(
  classified: readonly ClassifiedRow[],
  year: number,
  d: Difference,
): ClassifiedRow[] {
  const [y = '', period = ''] = d.month.split('-');
  const months = /^\d\d$/.test(period) ? [period] : monthsOfQuarter(period);
  return classified.filter(
    (c) =>
      c.row.year === year &&
      c.machine === d.machine &&
      months.some((m) => (c.row.date ?? '').startsWith(`${y}-${m}`)),
  );
}

const ROUNDED = 'only the hours differ, by 0.05 h or less (hand-typed hours)';

const monthsOfQuarter = (q: string): string[] =>
  [1, 2, 3].map((i) => String((Number(q[1]) - 1) * 3 + i).padStart(2, '0'));

/**
 * Each workbook's MTTR and MTBF sheets against the rows that workbook holds (a row dated in another year loads under
 * its own date but sits in its workbook's file, so it is matched by workbook, not by date). Loaded months dated
 * outside the workbook's year have no column on its sheets: they are counted as unmatched, named, never as differences.
 * A difference is named with the counting rule of the sheet that reproduces it, or `unexplained`.
 */
function printCheck(
  data: string,
  plant: Plant,
  checked: { plantData: PlantData; yearOf: Map<string, number>; classified: ClassifiedRow[] },
): { named: number; unexplained: number } {
  const { plantData, yearOf, classified } = checked;
  const machineOf = (label: string): string | null => {
    const code = foldMachine(label, plant.machines);
    return plant.machines.has(code) ? code : null;
  };
  const causes = new Map<number, Map<string, number>>();
  const total = { named: 0, unexplained: 0 };
  for (const { path, year } of findWorkbooks(data)) {
    const mine = loadedFigures(plantData, { year, yearOf });
    const unmatched = [...mine.keys()].filter((at) => !at.includes(` ${year}-`)).length;
    const summary = parseSummary(readWorkbook(path), year, machineOf);
    const result = compare(summary, mine);
    const named = result.different.map((d) => ({
      d,
      cause: d.withinRounding ? ROUNDED : explain(d, rowsOf(classified, year, d)),
    }));
    const open = named.filter((n) => /unexplained/.test(n.cause)).length;
    const rounded = named.filter((n) => n.cause === ROUNDED).length;
    total.named += named.length;
    total.unexplained += open;
    console.log(
      `check ${year}: ${result.compared} machine-months, equal ${result.equal}, within 0.05 h ${rounded}, explained ${named.length - open - rounded}, unexplained ${open}` +
        ` | unmatched, named (loaded months outside the year) ${unmatched}` +
        ` | labels not in the plant ${summary.notPlant.length} | unreadable summary sheets ${summary.unreadable}`,
    );
    const by = causes.get(year) ?? new Map<string, number>();
    for (const { d, cause } of named) {
      console.log(`  ${formatDifference(d)} | cause: ${cause}`);
      by.set(cause, (by.get(cause) ?? 0) + 1);
    }
    causes.set(year, by);
  }
  for (const [year, by] of [...causes].sort((a, b) => a[0] - b[0])) {
    console.log(
      `causes ${year}: ${[...by].map(([cause, n]) => `${cause} ${n}`).join(' | ') || '-'}`,
    );
  }
  return total;
}

export async function main(argv = process.argv.slice(2)): Promise<LoadResult> {
  const { tenant: slug, allowRemote, rest } = split(argv);
  const args = parseArgs(rest);
  if (args.has('out'))
    throw new Error(`unknown option --out (nothing is written to a folder)\n${USAGE}`);
  const data = args.get('data');
  const url = process.env.DATABASE_URL;
  if (!data || !url) throw new Error(`${USAGE}\nDATABASE_URL is required`);
  const plant = loadPlant(args.get('plant'));
  const { files, classified } = convert(data, plant, args);
  const { pool, tenant } = await connect(url, slug, allowRemote);
  try {
    const loaded = await loadLegacyYears(pool, tenant, files);
    for (const l of loaded) {
      console.log(
        `load ${l.year}: batch ${l.batchId} ${l.status} | imported ${l.imported} skipped ${l.skipped} errored ${l.errored}` +
          ` | list entries added or switched on ${l.added.length} | placeholder people ${l.people}`,
      );
    }
    if (loaded.length < files.length || loaded.some((l) => l.status !== 'done')) {
      process.exitCode = 1;
      return { loaded, named: 0, unexplained: 0 };
    }
    const plantData = await engineData(pool, tenant.id);
    printEngine(
      plantData,
      files.map((file) => file.year),
    );
    const yearOf = await workbookYears(pool, tenant.id);
    const { named, unexplained } = printCheck(data, plant, { plantData, yearOf, classified });
    return { loaded, named, unexplained };
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
