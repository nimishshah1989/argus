import { pathToFileURL } from 'node:url';
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
import { compare, formatDifference, loadedFigures, parseSummary } from './legacy-check.js';

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
}

type Plant = ReturnType<typeof loadPlant>;
type Files = ReturnType<typeof convertLegacy>['files'];
type PlantData = Awaited<ReturnType<typeof engineData>>;

/** The workbooks to one file per year, each report printed; nothing is loaded if an identity is broken. */
function convert(data: string, plant: Plant, args: Map<string, string>): Files {
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
  return files;
}

/** The engine once per year with an explicit period: the breakdown count and the months with no records. */
function printEngine(plantData: PlantData, years: readonly number[]): void {
  for (const year of years) {
    const result = runYear(plantData, year);
    const none = result.period?.noRecords ?? [];
    const count = String(figureOf(result, 'dashboard.total-breakdowns'));
    console.log(`engine ${year}: breakdowns ${count} | no records: ${none.join(' ') || '-'}`);
  }
}

/**
 * Each workbook's MTTR and MTBF sheets against the rows that workbook holds (a row dated in another year loads under
 * its own date but sits in its workbook's file, so it is matched by workbook, not by date). Loaded months dated
 * outside the workbook's year have no column on its sheets: they are counted as unmatched, named, never as differences.
 */
function printCheck(
  data: string,
  plant: Plant,
  plantData: PlantData,
  yearOf: Map<string, number>,
): number {
  const machineOf = (label: string): string | null => {
    const code = foldMachine(label, plant.machines);
    return plant.machines.has(code) ? code : null;
  };
  let named = 0;
  for (const { path, year } of findWorkbooks(data)) {
    const mine = loadedFigures(plantData, { year, yearOf });
    const unmatched = [...mine.keys()].filter((at) => !at.includes(` ${year}-`)).length;
    const summary = parseSummary(readWorkbook(path), year, machineOf);
    const result = compare(summary, mine);
    named += result.different.length;
    console.log(
      `check ${year}: ${result.compared} machine-months, equal ${result.equal}, named ${result.different.length}` +
        ` | unmatched, named (loaded months outside the year) ${unmatched}` +
        ` | labels not in the plant ${summary.notPlant.length} | unreadable summary sheets ${summary.unreadable}`,
    );
    for (const difference of result.different) console.log(`  ${formatDifference(difference)}`);
  }
  return named;
}

export async function main(argv = process.argv.slice(2)): Promise<LoadResult> {
  const { tenant: slug, allowRemote, rest } = split(argv);
  const args = parseArgs(rest);
  if (args.has('out')) throw new Error(`unknown option --out (nothing is written to a folder)\n${USAGE}`);
  const data = args.get('data');
  const url = process.env.DATABASE_URL;
  if (!data || !url) throw new Error(`${USAGE}\nDATABASE_URL is required`);
  const plant = loadPlant(args.get('plant'));
  const files = convert(data, plant, args);
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
      return { loaded, named: 0 };
    }
    const plantData = await engineData(pool, tenant.id);
    printEngine(
      plantData,
      files.map((file) => file.year),
    );
    const named = printCheck(data, plant, plantData, await workbookYears(pool, tenant.id));
    return { loaded, named };
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
