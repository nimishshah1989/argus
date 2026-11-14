import { readFileSync } from 'node:fs';
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

/** The screens the M4a triage keeps, with the ticket that owns each (columns: id, screen, verdict, ticket). */
export function keptScreens(triage: string): { id: string; ticket: string }[] {
  return triage
    .split('\n')
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter(
      (cells) => cells.length > 5 && cells[3] === 'KEPT' && /^[a-z0-9-]+$/.test(cells[1] ?? ''),
    )
    .map((cells) => ({ id: cells[1] as string, ticket: cells[4] as string }));
}

function screenErrors(file: ParityFile, triage: string): string[] {
  const errors: string[] = [];
  for (const kept of keptScreens(triage)) {
    const row = file.rows.find((candidate) => candidate.screen === kept.id);
    if (!row) errors.push(`screen ${kept.id}: kept in the M4a triage but has no parity row`);
    else if (!row.ticket?.trim()) errors.push(`screen ${kept.id}: row ${row.id} has no ticket`);
    else if (row.ticket !== kept.ticket)
      errors.push(
        `screen ${kept.id}: row ${row.id} names ticket ${row.ticket} but the triage names ${kept.ticket}`,
      );
  }
  return errors;
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
  errors.push(...sourceErrors(file, markdown), ...screenErrors(file, triage));
  return errors;
}

export function counts(rows: ParityRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) out.set(row.status, (out.get(row.status) ?? 0) + 1);
  return out;
}
