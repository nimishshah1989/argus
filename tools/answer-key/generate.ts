import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page } from '@playwright/test';
import { pseudonymise } from '../../scripts/pseudonymise-export.js';
import { loadDenyList } from '../pii-sources.js';
import { openPlatform, readPage, type Figure } from './platform.js';
import { SCREENS, type ScreenSpec } from './screens.js';
import { readWorkbook, type Sheets } from './xlsx.js';

/**
 * Hand-run, never in CI: `pnpm tsx tools/answer-key/generate.ts`. Runs Bhavin's 11 November platform on his 11 November
 * workbook at a frozen date and writes `fixtures/answer-key/<screen>.json` (what each screen shows) and `input.json`
 * (the data it was computed from). Names and phones are coded with the same pseudonymiser as the other fixtures.
 */

export const AS_OF = '2026-11-11';
const ROOT = 'docs/discovery/real-2026-11-13';
const OUT = 'fixtures/answer-key';
const BIG_TABLE = 150;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function trim(figure: Figure, keepText: boolean): Record<string, Json> {
  const tables = figure.tables.map((t) =>
    t.rows.length > BIG_TABLE
      ? { ...t, rows: t.rows.slice(0, 3), rowCount: t.rows.length, truncated: true }
      : { ...t, rowCount: t.rows.length },
  );
  const { text, ...rest } = figure;
  return { ...rest, tables, ...(keepText && tables.length === 0 ? { text } : {}) } as never;
}

async function readScreen(page: Page, spec: ScreenSpec): Promise<Json> {
  const pages: Json[] = [];
  for (const p of spec.pages) {
    const figure = await readPage(page, p);
    pages.push({ page: p.page, ...trim(figure, !spec.extra) });
  }
  const extra = spec.extra ? ((await page.evaluate(spec.extra)) as Json) : undefined;
  return { screen: spec.id, asOf: AS_OF, pages, ...(extra === undefined ? {} : { extra }) };
}

const INPUT_STATE =
  '({machines:state.machines,convMachines:state.convMachines,procMachines:state.procMachines,' +
  'utilMachines:state.utilMachines,dgMachines:state.dgMachines,breakdowns:state.breakdowns,otherBD:state.otherBD,' +
  'cellChangeLog:state.cellChangeLog,pmPlan:state.pmPlan,pmReports:state.pmReports,' +
  'settings:Object.fromEntries(Object.entries(state.settings).filter(([k])=>!["dcLog","dcSnap"].includes(k)))})';

function namesIn(input: Json): string[] {
  const state = input as {
    settings: { team: { name: string }[] };
    pmReports: Record<string, string>[];
  };
  const fields = ['doneBy', 'reviewedBy', 'prodSup', 'maintSup'];
  const reports = state.pmReports.flatMap((r) => fields.map((f) => r[f] ?? ''));
  return [...state.settings.team.map((t) => t.name), ...reports]
    .flatMap((n) => n.split(/[,&/]/))
    .map((n) => n.trim().toLowerCase())
    .filter((n) => n.length >= 3);
}

/** One line per row so a reviewer can read a table; objects up to 700 characters stay on one line. */
export function render(value: Json, indent = ''): string {
  const flat = (v: Json): boolean =>
    v === null || typeof v !== 'object' || JSON.stringify(v).length <= 700;
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (
      value.every((v) => v === null || typeof v !== 'object') &&
      JSON.stringify(value).length <= 100
    )
      return JSON.stringify(value);
    return `[\n${value.map((v) => inner + (flat(v) ? JSON.stringify(v) : render(v, inner))).join(',\n')}\n${indent}]`;
  }
  if (value !== null && typeof value === 'object') {
    const rows = Object.entries(value).map(
      ([k, v]) => `${inner}${JSON.stringify(k)}: ${flat(v) ? JSON.stringify(v) : render(v, inner)}`,
    );
    return `{\n${rows.join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

/** The sheets of the platform's export and their size: what "the whole data set exports as the platform's workbook" must reproduce. */
function workbookShape(sheets: Sheets): Json {
  const sheet = Object.entries(sheets).map(([name, rows]) => {
    const at = rows.findIndex((r) => r.length > 3 && r.every((c) => typeof c !== 'number'));
    return { name, header: rows[Math.max(at, 0)] ?? [], dataRows: rows.length - at - 1 };
  });
  return { screen: 'workbook-export', asOf: AS_OF, sheets: sheet };
}

async function main(): Promise<void> {
  const sheets = readWorkbook(join(ROOT, 'cosmos-export-2026-11-11.xlsx'));
  const html = join(process.cwd(), ROOT, 'cosmos_platform-2026-11-11.html');
  const page = await openPlatform(html, sheets, new Date(`${AS_OF}T12:00:00+05:30`));
  const files: Record<string, Json> = {};
  files.input = (await page.evaluate(INPUT_STATE)) as Json;
  files['workbook-export'] = workbookShape(sheets);
  const extra = namesIn(files.input);
  for (const spec of SCREENS) files[spec.id] = await readScreen(page, spec);
  await page.context().browser()?.close();
  const deny = loadDenyList();
  const coded = pseudonymise(files, { ...deny, names: [...deny.names, ...extra] });
  mkdirSync(OUT, { recursive: true });
  for (const [id, value] of Object.entries(coded.value as Record<string, Json>)) {
    writeFileSync(join(OUT, `${id}.json`), `${render(value)}\n`);
  }
  console.log(
    `answer key: ${Object.keys(files).length} files in ${OUT}; ${coded.people} people coded`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
