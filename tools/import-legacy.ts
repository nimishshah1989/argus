import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  classifyLegacy,
  DEFAULT_SWITCHES,
  type Switches,
  type YearReport,
} from '../apps/server/src/seed/legacy-classify.js';
import { convertLegacy, type PlantContext } from '../apps/server/src/seed/legacy-export.js';
import { readSheet, type LegacyRow } from '../apps/server/src/seed/legacy-sheets.js';
import { readWorkbook } from './answer-key/xlsx.js';
import { compareGrid, readMonthGrid } from './legacy-grid.js';

/**
 * `pnpm import:legacy --data <folder> --out <folder> [--plant <file>] [--star ..] [--retired ..] [--gap ..] [--fold ..]`
 *
 * Reads the 2022-2025 maintenance workbooks and writes one `argus.synthetic-bhavin/v1` file per workbook year
 * (`legacy-<year>.json`); `pnpm import:bhavin <file> --tenant <slug>` loads each. Read-only, no database. The
 * workbooks hold real names, so the output folder may not sit inside this repository and the printed report
 * carries counts and machine codes only. The switches S1, S2, S4 and S5 are the flags; each prints at the top.
 */
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED_MACHINES = new URL(
  '../apps/server/src/seed/generated/cosmos-machines.json',
  import.meta.url,
);
const OPTIONS = ['data', 'out', 'plant', 'star', 'retired', 'gap', 'fold', 'grid'];
const USAGE =
  'usage: import:legacy --data <folder> --out <folder> [--plant <file>] [--star A=B,..] [--retired drop|keep] [--gap none|YYYY-MM,..] [--fold A=B,..] [--grid <Jul-23.xlsx>]';

function pairs(value: string, fallback: Record<string, string>): Record<string, string> {
  if (value === 'default') return fallback;
  if (value === 'off' || value === 'none') return {};
  return Object.fromEntries(
    value.split(',').map((pair) => {
      const [from, to] = pair.split('=');
      if (!from || !to) throw new Error(`expected NAME=TARGET pairs, got "${pair}"`);
      return [from.trim().toUpperCase(), to.trim().toUpperCase()];
    }),
  );
}

function months(value: string): string[] {
  const list = value.split(',').map((month) => month.trim());
  const bad = list.find((month) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(month));
  if (bad !== undefined) throw new Error(`--gap takes YYYY-MM months or none, got "${bad}"`);
  return list;
}

export function parseSwitches(args: ReadonlyMap<string, string>): Switches {
  const retired = args.get('retired') ?? 'drop';
  if (retired !== 'drop' && retired !== 'keep') throw new Error('--retired is drop or keep');
  const gap = args.get('gap');
  return {
    star: pairs(args.get('star') ?? 'default', DEFAULT_SWITCHES.star),
    retired,
    gap: gap === undefined ? DEFAULT_SWITCHES.gap : gap === 'none' ? [] : months(gap),
    fold: pairs(args.get('fold') ?? 'default', DEFAULT_SWITCHES.fold),
  };
}

/** The folder with symlinks resolved, also when it does not exist yet (its nearest existing ancestor is resolved). */
function canonical(folder: string): string {
  const tail: string[] = [];
  let at = resolve(folder);
  while (!existsSync(at) && dirname(at) !== at) {
    tail.unshift(basename(at));
    at = dirname(at);
  }
  return join(realpathSync(at), ...tail);
}

/** True when `folder` or any parent holds a `.git` entry: any checkout, worktrees included. */
function insideCheckout(folder: string): boolean {
  for (let at = folder; ; at = dirname(at)) {
    if (existsSync(join(at, '.git'))) return true;
    if (dirname(at) === at) return false;
  }
}

export function assertOutsideRepo(out: string): void {
  const target = canonical(out);
  const rel = relative(realpathSync(REPO), target);
  const inside = rel === '' || (rel.split(sep)[0] !== '..' && !isAbsolute(rel));
  if (inside || insideCheckout(target)) {
    throw new Error('--out must be a folder outside any git checkout: the output holds history');
  }
}

/** Every workbook under `dir` with a four-digit year in its name; hidden files and `__MACOSX` are skipped. */
export function findWorkbooks(dir: string): { path: string; year: number }[] {
  const found: { path: string; year: number }[] = [];
  const walk = (folder: string): void => {
    for (const entry of readdirSync(folder).sort()) {
      const path = join(folder, entry);
      if (entry.startsWith('.') || entry.startsWith('~$') || entry === '__MACOSX') continue;
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith('.xlsx')) {
        const year = /(20\d\d)/.exec(basename(entry))?.[1];
        if (year) found.push({ path, year: Number(year) });
      }
    }
  };
  walk(dir);
  return found.sort((a, b) => a.year - b.year || (a.path < b.path ? -1 : 1));
}

function strings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`--plant file: "${field}" must be an array of strings`);
  }
  return value as string[];
}

export function loadPlant(file: string | undefined): PlantContext {
  if (file) {
    const plant = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    const people = plant.people ?? [];
    if (!Array.isArray(people)) throw new Error('--plant file: "people" must be an array');
    people.forEach((p, i) => {
      const entry = p as Record<string, unknown> | null;
      if (typeof entry?.name !== 'string' || typeof entry.code !== 'string')
        throw new Error(`--plant file: "people[${i}]" needs a string "name" and a string "code"`);
    });
    return {
      machines: new Set(strings(plant.machines, 'machines')),
      people: people as { name: string; code: string }[],
      terms: strings(plant.terms, 'terms'),
    };
  }
  const seed = JSON.parse(readFileSync(SEED_MACHINES, 'utf8')) as { machines: { code: string }[] };
  return { machines: new Set(seed.machines.map((m) => m.code)), people: [], terms: [] };
}

export interface Read {
  rows: LegacyRow[];
  sheets: Map<number, string[]>;
}

/** One workbook at a time: its grid is dropped before the next opens, so memory peaks at the biggest one. */
export function readAll(dir: string, known: ReadonlySet<string>): Read {
  const rows: LegacyRow[] = [];
  const sheets = new Map<number, string[]>();
  for (const { path, year } of findWorkbooks(dir)) {
    for (const [name, grid] of Object.entries(readWorkbook(path))) {
      const sheet = readSheet(year, name, grid, known);
      if (!sheet) continue;
      for (const row of sheet.rows) rows.push(row);
      sheets.set(year, [...(sheets.get(year) ?? []), `${sheet.machine}=${sheet.dated}`]);
    }
  }
  return { rows, sheets };
}

const list = (counter: Record<string, number>): string =>
  Object.entries(counter)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([key, n]) => `${key}:${n}`)
    .join(' ') || '-';

export function formatReport(report: YearReport, sheets: readonly string[]): string[] {
  const m = report.measured;
  const unknown = Object.values(report.unknownMachine).reduce((a, b) => a + b, 0);
  return [
    `== ${report.year}: ${sheets.length} machine sheets`,
    `sheets: ${sheets.join(' ')}`,
    `rows read ${report.read} | bad date ${report.badDate} | moved out ${report.movedOut} in ${report.movedIn}`,
    `duplicate ${report.duplicate} | stray year ${report.strayYear} | gap month ${report.gapMonth} | unknown machine ${unknown} (${list(report.unknownMachine)})`,
    `utility rows ${report.utilityRows} -> ${report.events} events (${report.eventDays} days, ${report.utilityMerged ?? 0} merged into a same-machine line, ${report.utilityCodeConflicts ?? 0} with two codes) | tickets loaded ${report.tickets}`,
    `stray shift ${report.strayShift} | blank code ${report.blankCode} | blank minutes ${report.blankMinutes} | uti hours on breakdown ${report.utiOnBreakdown} | possible repeat ${m.repeats} | possible duplicate person ${report.possibleDuplicatePeople}`,
    `codes: ${list(report.codes)}`,
    `loaded by machine: ${list(report.machines)}`,
    `identity read = tickets + utility + duplicate + stray year + unknown + gap month: ${report.identity ? 'holds' : 'BROKEN'}`,
    `plan check: with date ${m.withDate} own year ${m.ownYear} other year ${m.otherYear} already there ${m.alreadyThere} no workbook ${m.noWorkbook} | utility ${m.utilityRows} hours-only ${m.utilityHoursOnly} days ${m.utilityDays} most-one-day ${m.utilityMostOneDay} hours ${m.utilityHours} | breakdowns ${m.breakdowns} hours ${m.breakdownHours} | pm ${m.pm} blank code ${m.blankCode} blank minutes ${m.blankMinutes} | repeats ${m.repeats}`,
  ];
}

export function parseArgs(argv: readonly string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag?.startsWith('--') || value === undefined) throw new Error(USAGE);
    if (!OPTIONS.includes(flag.slice(2))) throw new Error(`unknown option ${flag}\n${USAGE}`);
    args.set(flag.slice(2), value);
  }
  return args;
}

export function main(argv = process.argv.slice(2)): void {
  const args = parseArgs(argv);
  const data = args.get('data');
  const out = args.get('out');
  if (!data || !out) throw new Error(USAGE);
  assertOutsideRepo(out);
  const switches = parseSwitches(args);
  console.log(`switches: ${JSON.stringify(switches)}`);
  const plant = loadPlant(args.get('plant'));
  const { rows, sheets } = readAll(data, plant.machines);
  const { files, reports } = convertLegacy(rows, plant, switches);
  for (const report of reports) {
    console.log(formatReport(report, sheets.get(report.year) ?? []).join('\n'));
  }
  const gridFile = args.get('grid');
  if (gridFile) {
    const month = readMonthGrid(readWorkbook(gridFile), plant.machines);
    const classified = classifyLegacy(rows, plant.machines, switches).rows;
    console.log(
      ['== Jul-23 grid vs register', ...compareGrid(month, classified, '2023-07')].join('\n'),
    );
  }
  if (files.length === 0) throw new Error('no workbook with a year in its name was found');
  if (reports.some((report) => !report.identity)) {
    throw new Error('the reconciliation identity is broken; nothing was written');
  }
  mkdirSync(out, { recursive: true });
  for (const file of files) writeFileSync(join(out, `legacy-${file.year}.json`), file.json);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
