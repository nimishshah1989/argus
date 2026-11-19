import { pathToFileURL } from 'node:url';
import { convertLegacy } from '../apps/server/src/seed/legacy-export.js';
import {
  connect,
  engineData,
  figureOf,
  loadLegacyYears,
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
 * [--gap ..] [--fold ..]` (ticket 69c). Converts the workbooks as `pnpm import:legacy` does, adds the list entries the
 * old history names, loads each year in order through the importer into the database on `DATABASE_URL`, runs the
 * engine once per year and sets each workbook's MTTR and MTBF sheets against what was loaded. Local database only
 * until 69d; the printed lines carry counts and machine codes, never a row's text.
 */
const USAGE =
  'usage: load-legacy --data <folder> --tenant <slug> [--plant <file>] [--star|--retired|--gap|--fold ..]';

function split(argv: readonly string[]): { tenant: string; rest: string[] } {
  const at = argv.indexOf('--tenant');
  const tenant = at < 0 ? undefined : argv[at + 1];
  if (!tenant) throw new Error(USAGE);
  return { tenant, rest: argv.filter((_, i) => i !== at && i !== at + 1) };
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

/** Each workbook's MTTR and MTBF sheets against the loaded plant: equal, or the named pair. */
function printCheck(data: string, plant: Plant, plantData: PlantData): void {
  const mine = loadedFigures(plantData);
  const machineOf = (label: string): string | null => {
    const code = foldMachine(label, plant.machines);
    return plant.machines.has(code) ? code : null;
  };
  for (const { path, year } of findWorkbooks(data)) {
    const summary = parseSummary(readWorkbook(path), year, machineOf);
    const result = compare(summary, mine);
    console.log(
      `check ${year}: ${result.compared} machine-months, equal ${result.equal}, named ${result.different.length}` +
        ` | labels not in the plant ${summary.notPlant.length} | unreadable summary sheets ${summary.unreadable}`,
    );
    for (const difference of result.different) console.log(`  ${formatDifference(difference)}`);
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const { tenant: slug, rest } = split(argv);
  const args = parseArgs(rest);
  const data = args.get('data');
  const url = process.env.DATABASE_URL;
  if (!data || !url) throw new Error(`${USAGE}\nDATABASE_URL is required`);
  const plant = loadPlant(args.get('plant'));
  const files = convert(data, plant, args);
  const { pool, tenant } = await connect(url, slug);
  try {
    const loaded = await loadLegacyYears(pool, tenant, files);
    for (const l of loaded) {
      console.log(
        `load ${l.year}: batch ${l.batchId} ${l.status} | imported ${l.imported} skipped ${l.skipped} errored ${l.errored}` +
          ` | list entries added ${l.added.length} | placeholder people ${l.people}`,
      );
    }
    if (loaded.length < files.length || loaded.some((l) => l.status !== 'done')) {
      process.exitCode = 1;
      return;
    }
    const plantData = await engineData(pool, tenant.id);
    printEngine(
      plantData,
      files.map((file) => file.year),
    );
    printCheck(data, plant, plantData);
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
