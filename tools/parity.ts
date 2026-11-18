import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export type Disposition = 'keep' | 'improve' | 'replace' | 'drop';
export type Status = 'todo' | 'in-progress' | 'done' | 'waived' | 'external';

export interface ParityRow {
  id: string;
  feature: string;
  disposition: Disposition;
  milestone: string;
  milestones?: string[];
  status: Status;
  waiver_reason?: string;
  external_reason?: string;
  evidence: string[];
  source?: string;
  ticket?: string;
  /** The M4a triage id of the screen this row tracks (docs/plan/m4a-triage.md). */
  screen?: string;
}

export interface ParityFile {
  version: number;
  expected_rows?: number;
  rows: ParityRow[];
}

const DISPOSITIONS: Disposition[] = ['keep', 'improve', 'replace', 'drop'];
const STATUSES: Status[] = ['todo', 'in-progress', 'done', 'waived', 'external'];
const ID = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;

export function loadParity(path = 'docs/spec/parity.yaml'): ParityFile {
  const file = parse(readFileSync(path, 'utf8')) as ParityFile;
  if (!file || !Array.isArray(file.rows)) throw new Error(`${path}: rows must be an array`);
  return file;
}

export function parseImportSourceRow(
  markdown: string,
): Pick<ParityRow, 'id' | 'feature' | 'disposition' | 'milestone'> {
  const lines = markdown
    .split('\n')
    .filter((line) => line.trimStart().startsWith('| v3.import.01 |'));
  if (lines.length !== 1)
    throw new Error('PARITY.md: expected exactly one v3.import.01 source row');
  const cells = (lines[0] as string)
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
  const [id, feature, stance, milestone] = cells;
  const disposition = stance?.split(/[ ;]/)[0]?.toLowerCase() as Disposition;
  if (id !== 'v3.import.01' || !feature || !DISPOSITIONS.includes(disposition) || !milestone) {
    throw new Error('PARITY.md: invalid v3.import.01 source row');
  }
  return { id, feature, disposition, milestone };
}

function identityErrors(row: ParityRow, seen: Set<string>): string[] {
  const errors: string[] = [];
  if (!ID.test(row.id)) errors.push(`${row.id}: invalid id`);
  if (seen.has(row.id)) errors.push(`${row.id}: duplicate id`);
  return errors;
}

function fieldErrors(row: ParityRow): string[] {
  const errors: string[] = [];
  if (!row.feature?.trim()) errors.push(`${row.id}: empty feature`);
  if (!DISPOSITIONS.includes(row.disposition)) errors.push(`${row.id}: bad disposition`);
  if (!STATUSES.includes(row.status)) errors.push(`${row.id}: bad status`);
  if (!/^M[0-6][ab]?$/.test(row.milestone)) errors.push(`${row.id}: bad milestone`);
  return errors;
}

function reasonErrors(row: ParityRow): string[] {
  const errors: string[] = [];
  if (row.status === 'waived' && !row.waiver_reason?.trim())
    errors.push(`${row.id}: waived without a reason`);
  if (row.status === 'external' && !row.external_reason?.trim())
    errors.push(`${row.id}: external without a reason`);
  return errors;
}

function evidenceErrors(row: ParityRow): string[] {
  const errors = reasonErrors(row);
  if (row.status === 'done' && !row.evidence?.length)
    errors.push(`${row.id}: done without evidence`);
  if (row.status === 'in-progress' && !row.evidence?.length && !row.ticket?.trim())
    errors.push(`${row.id}: in-progress without evidence or a ticket`);
  return errors;
}

function rowErrors(row: ParityRow, seen: Set<string>): string[] {
  return [...identityErrors(row, seen), ...fieldErrors(row), ...evidenceErrors(row)];
}

function sourceErrors(file: ParityFile, markdown: string): string[] {
  let source: ReturnType<typeof parseImportSourceRow>;
  try {
    source = parseImportSourceRow(markdown);
  } catch (error) {
    return [(error as Error).message];
  }
  const row = file.rows.find((candidate) => candidate.id === source.id);
  if (!row) return [`${source.id}: missing ledger row for PARITY.md source`];
  const errors: string[] = [];
  for (const key of ['feature', 'disposition', 'milestone'] as const) {
    if (row[key] !== source[key])
      errors.push(`${source.id}: ${key} does not match PARITY.md source`);
  }
  return errors;
}

const TRIAGE = 'docs/plan/m4a-triage.md';

/** The M4a triage table as rows: id, verdict, ticket and the answer-key files it names. */
function triageRows(
  triage: string,
): { id: string; verdict: string; ticket: string; keys: string[] }[] {
  return triage
    .split('\n')
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter(
      (cells) =>
        cells.length > 5 &&
        /^[a-z0-9-]+$/.test(cells[1] ?? '') &&
        ['KEPT', 'DROPPED', 'DEFERRED'].includes(cells[3] ?? ''),
    )
    .map((cells) => ({
      id: cells[1] as string,
      verdict: cells[3] as string,
      ticket: cells[4] as string,
      keys: (cells[5] ?? '-')
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean),
    }));
}

/** The screens the M4a triage keeps, with the ticket that owns each (columns: id, screen, verdict, ticket). */
export function keptScreens(triage: string): { id: string; ticket: string }[] {
  return triageRows(triage)
    .filter((row) => row.verdict === 'KEPT')
    .map((row) => ({ id: row.id, ticket: row.ticket }));
}

/** A screen the triage dropped; any parity row that still tracks it must be waved off. */
function droppedScreenErrors(file: ParityFile, triage: string): string[] {
  const errors: string[] = [];
  const dropped = triage
    .split('\n')
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter(
      (cells) => cells.length > 5 && cells[3] === 'DROPPED' && /^[a-z0-9-]+$/.test(cells[1] ?? ''),
    )
    .map((cells) => cells[1] as string);
  for (const id of dropped) {
    for (const row of file.rows.filter((candidate) => candidate.screen === id)) {
      if (row.disposition !== 'drop' || row.status !== 'waived')
        errors.push(
          `screen ${id}: dropped in the M4a triage but row ${row.id} still claims work (${row.status}, ${row.disposition})`,
        );
    }
  }
  return errors;
}

function screenErrors(file: ParityFile, triage: string): string[] {
  const errors: string[] = [];
  for (const kept of keptScreens(triage)) {
    const tracking = file.rows.filter((candidate) => candidate.screen === kept.id);
    const row = tracking[0];
    if (tracking.length > 1)
      errors.push(
        `screen ${kept.id}: ${tracking.length} rows track it (${tracking.map((r) => r.id).join(', ')}); keep one`,
      );
    else if (!row) errors.push(`screen ${kept.id}: kept in the M4a triage but has no parity row`);
    else if (!row.ticket?.trim()) errors.push(`screen ${kept.id}: row ${row.id} has no ticket`);
    else if (row.ticket !== kept.ticket)
      errors.push(
        `screen ${kept.id}: row ${row.id} names ticket ${row.ticket} but the triage names ${kept.ticket}`,
      );
  }
  return errors;
}

const ANSWER_KEY = 'fixtures/answer-key';

/** Fixtures that answer more than the screen named after them. */
const SHARED_KEYS: Record<string, string[]> = {
  dashboard: ['drill-down'],
  registers: ['cell-change-log'],
  'machine-page': ['machine-pages'],
  'legacy-settings': ['settings'],
  'workbook-export': ['amc-warranty', 'legal-compliance', 'pm-reports'],
  'a7-footprint': ['footprint'],
  'a8-age': ['age'],
};

/** Fixtures that are data, not a screen's key: the workbook, and the R8 map of nine unattributed mentions. */
const DATA_FILES = new Set(['input.json', 'person-mentions.json']);

function declaredScreen(path: string): string | undefined {
  try {
    return (JSON.parse(readFileSync(path, 'utf8')) as { screen?: string }).screen;
  } catch {
    return undefined;
  }
}

/** Every fixture in the answer key must declare the screen its file name says it answers. */
function fixtureScreenErrors(root: string): string[] {
  const errors: string[] = [];
  for (const file of readdirSync(root).filter((name) => name.endsWith('.json'))) {
    if (DATA_FILES.has(file)) continue;
    const expected = file.slice(0, -5);
    const declared = declaredScreen(join(root, file));
    if (declared !== expected)
      errors.push(`${file}: declares screen ${declared ?? 'none'}, expected ${expected}`);
  }
  return errors;
}

/** The Key column of one triage row: each file exists, declares its own screen, and answers this row. */
function keyErrors(row: { id: string; keys: string[] }, root: string): string[] {
  const errors: string[] = [];
  for (const key of row.keys) {
    if (key === 'input') continue;
    const path = join(root, `${key}.json`);
    if (!existsSync(path)) {
      errors.push(`${row.id}: answer key ${key}.json is missing`);
      continue;
    }
    const declared = declaredScreen(path);
    if (declared !== key) {
      errors.push(`${row.id}: answer key ${key}.json declares screen ${declared ?? 'none'}`);
      continue;
    }
    if (row.id !== key && !(SHARED_KEYS[key] ?? []).includes(row.id))
      errors.push(`${row.id}: answer key ${key}.json answers ${declared}, not ${row.id}`);
  }
  return errors;
}

/**
 * A triage row's Key column must name fixtures that declare that screen. A fixture named after
 * itself answers its namesake; the few shared files are listed above. `input.json` and the R8 mention map
 * are data, not keys.
 */
export function answerKeyErrors(triage: string, root = ANSWER_KEY): string[] {
  return [
    ...fixtureScreenErrors(root),
    ...triageRows(triage)
      .filter((row) => row.verdict !== 'DROPPED')
      .flatMap((row) => keyErrors(row, root)),
  ];
}

export function validateParity(
  file: ParityFile,
  markdown = readFileSync('docs/spec/PARITY.md', 'utf8'),
  triage = readFileSync(TRIAGE, 'utf8'),
): string[] {
  const errors: string[] = [];
  if (file.expected_rows !== undefined && file.rows.length !== file.expected_rows) {
    errors.push(`expected ${file.expected_rows} rows, found ${file.rows.length}`);
  }
  const seen = new Set<string>();
  for (const row of file.rows) {
    errors.push(...rowErrors(row, seen));
    seen.add(row.id);
  }
  errors.push(
    ...sourceErrors(file, markdown),
    ...screenErrors(file, triage),
    ...droppedScreenErrors(file, triage),
    ...answerKeyErrors(triage),
  );
  return errors;
}

export function counts(rows: ParityRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) out.set(row.status, (out.get(row.status) ?? 0) + 1);
  return out;
}
