import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page } from '@playwright/test';
import { pseudonymise } from '../../scripts/pseudonymise-export.js';
import { PHONE, isGenericLabel, loadDenyList } from '../pii-sources.js';
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
    pages.push({ page: p.page, ...trim(figure, !spec.noText) });
  }
  const extra = spec.extra ? ((await page.evaluate(spec.extra)) as Json) : undefined;
  return { screen: spec.id, asOf: AS_OF, pages, ...(extra === undefined ? {} : { extra }) };
}

const INPUT_STATE =
  '({machines:state.machines,convMachines:state.convMachines,procMachines:state.procMachines,' +
  'utilMachines:state.utilMachines,dgMachines:state.dgMachines,breakdowns:state.breakdowns,otherBD:state.otherBD,' +
  'cellChangeLog:state.cellChangeLog,pmPlan:state.pmPlan,pmReports:state.pmReports,' +
  'settings:Object.fromEntries(Object.entries(state.settings).filter(([k])=>!["dcLog","dcSnap"].includes(k)&&!/^bt/.test(k)))})';

interface InputState {
  settings: { machAmc: { id?: string }[]; machLegal: { id?: string }[] };
  [key: string]: unknown;
}

/** The platform numbers some lines with a fresh random id on every load; the key keeps none, so a regeneration is identical. */
function stable(input: Json): Json {
  const state = input as unknown as InputState;
  for (const lines of [state.settings.machAmc, state.settings.machLegal])
    for (const line of lines) delete line.id;
  return input;
}

/** Fields that hold a person, wherever they sit in the data (the log, the PM reports, the general-work log, acknowledgements). */
const PEOPLE_KEYS = new Set([
  'observedBy',
  'doneBy',
  'supportedBy',
  'reportedBy',
  'startedBy',
  'closedBy',
  'owner',
  'reviewedBy',
  'prodSup',
  'maintSup',
  'completedBy',
]);

/** Every person the data names, from the people fields anywhere in it and the team list; roles are not people. */
export function namesIn(input: Json): string[] {
  const found: string[] = [];
  const walk = (value: Json, key = ''): void => {
    if (typeof value === 'string') {
      if (PEOPLE_KEYS.has(key)) found.push(value);
    } else if (Array.isArray(value)) value.forEach((v) => walk(v, key));
    else if (value !== null && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) walk(v, k);
  };
  walk(input);
  const team = (input as { settings?: { team?: { name: string }[] } }).settings?.team ?? [];
  return [...team.map((t) => t.name), ...found]
    .flatMap((n) => String(n).split(/[,&/+]|\band\b/i))
    .map((n) => n.trim().replace(/\s+/g, ' ').toLowerCase())
    .filter((n) => n.length >= 3 && !isGenericLabel(n));
}

/**
 * A model or serial number in a machine register can look like a phone number. Those strings are swapped for
 * markers before coding and put back after, so a dryer's model stays what it is while real phones are still coded.
 */
function shield(files: Record<string, Json>): {
  shielded: Record<string, Json>;
  restore: (v: Json) => Json;
} {
  const state = files.input as unknown as Record<string, Record<string, unknown>[]>;
  const keep = new Set<string>();
  for (const list of ['machines', 'convMachines', 'procMachines', 'utilMachines', 'dgMachines'])
    for (const machine of state[list] ?? [])
      for (const field of ['make', 'model', 'serial', 'ctrlModel', 'ctrlSerial', 'assetCode'])
        for (const hit of String(machine[field] ?? '').matchAll(PHONE)) keep.add(hit[0]);
  const marks = [...keep].sort().map((text, i) => [text, `\uE000${i}\uE001`] as const);
  const swap = (from: 0 | 1, to: 0 | 1) => {
    const walk = (v: Json): Json => {
      if (typeof v === 'string') return marks.reduce((t, m) => t.split(m[from]).join(m[to]), v);
      if (Array.isArray(v)) return v.map(walk);
      if (v !== null && typeof v === 'object')
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
      return v;
    };
    return walk;
  };
  return { shielded: swap(0, 1)(files) as Record<string, Json>, restore: swap(1, 0) };
}

/** A company named after a person ("Kailash industries") is coded like a person: Vendor 01, 02, in order of first appearance. */
function codeVendors(files: Record<string, Json>): Record<string, Json> {
  const seen = new Map<string, string>();
  const pattern = /\b[A-Z][a-z]+ (?:industries|enterprises?)\b/gi;
  const swap = (text: string): string =>
    text.replace(pattern, (hit) => {
      const key = hit.toLowerCase();
      if (!seen.has(key)) seen.set(key, `Vendor ${String(seen.size + 1).padStart(2, '0')}`);
      return seen.get(key) as string;
    });
  const walk = (v: Json): Json => {
    if (typeof v === 'string') return swap(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === 'object')
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(files) as Record<string, Json>;
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

const readme = (chrome: string): string => `# Answer key (M4a)

What Bhavin's 11 November platform shows on his 11 November workbook, frozen at 11 Nov 2026. One file per screen; \`input.json\` is the data they were computed from. Names and phones are coded (the repo's pseudonymiser, deny list from the source files); machines, codes, faults and timings are real.

- **Plant local time.** Every figure was computed with the browser in \`Asia/Kolkata\`, locale \`en-IN\`. The engine (ticket 37) must use plant local time too: the same data gives different day boundaries, for example A1 breakdown hours, in UTC.
- **Forecast.** The planning forecast and Forecast Lab use the platform's seeded mulberry32 generator (\`fcRng(1000 + machine index)\`, 2,000 runs, \`FC_RUNS\`); the engine must reproduce the seed scheme to match.
- **Generated with** ${chrome}. Regenerate with \`pnpm tsx tools/answer-key/generate.ts\` (hand-run; set \`CHROMIUM_PATH\` if Playwright's browser is elsewhere). Two runs are identical: the platform's random ids on AMC and legal lines are left out.
- Screen labels are whitespace-normalised; table titles are the heading text only.
- Verdicts and owners: \`docs/plan/m4a-triage.md\`. Inputs and gaps: \`docs/plan/m4a-figures.md\`.
`;

async function main(): Promise<void> {
  const sheets = readWorkbook(join(ROOT, 'cosmos-export-2026-11-11.xlsx'));
  const html = join(process.cwd(), ROOT, 'cosmos_platform-2026-11-11.html');
  const page = await openPlatform(html, sheets, new Date(`${AS_OF}T12:00:00+05:30`));
  const files: Record<string, Json> = {};
  files.input = stable((await page.evaluate(INPUT_STATE)) as Json);
  files['workbook-export'] = workbookShape(sheets);
  const extra = namesIn(files.input);
  for (const spec of SCREENS) files[spec.id] = await readScreen(page, spec);
  const chrome = `Chromium ${page.context().browser()?.version() ?? 'unknown'}`;
  await page.context().browser()?.close();
  const deny = loadDenyList();
  const { shielded, restore } = shield(files);
  const coded = pseudonymise(shielded, { ...deny, names: [...deny.names, ...extra] });
  mkdirSync(OUT, { recursive: true });
  for (const [id, value] of Object.entries(
    codeVendors(restore(coded.value as Json) as Record<string, Json>),
  )) {
    writeFileSync(join(OUT, `${id}.json`), `${render(value)}\n`);
  }
  writeFileSync(join(OUT, 'README.md'), readme(chrome));
  console.log(
    `answer key: ${Object.keys(files).length} files in ${OUT}; ${coded.people} people coded`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
