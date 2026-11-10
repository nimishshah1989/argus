import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

export type Disposition = 'keep' | 'improve' | 'replace' | 'drop';
export type Status = 'todo' | 'in-progress' | 'done' | 'waived';

export interface ParityRow {
  id: string;
  feature: string;
  disposition: Disposition;
  milestone: string;
  milestones?: string[];
  status: Status;
  waiver_reason?: string;
  evidence: string[];
  source?: string;
}

export interface ParityFile {
  version: number;
  expected_rows?: number;
  rows: ParityRow[];
}

const DISPOSITIONS: Disposition[] = ['keep', 'improve', 'replace', 'drop'];
const STATUSES: Status[] = ['todo', 'in-progress', 'done', 'waived'];
const ID = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;

export function loadParity(path = 'docs/spec/parity.yaml'): ParityFile {
  const file = parse(readFileSync(path, 'utf8')) as ParityFile;
  if (!file || !Array.isArray(file.rows)) throw new Error(`${path}: rows must be an array`);
  return file;
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

function evidenceErrors(row: ParityRow): string[] {
  const errors: string[] = [];
  if (row.status === 'done' && !row.evidence?.length)
    errors.push(`${row.id}: done without evidence`);
  if (row.status === 'waived' && !row.waiver_reason?.trim())
    errors.push(`${row.id}: waived without a reason`);
  return errors;
}

function rowErrors(row: ParityRow, seen: Set<string>): string[] {
  return [...identityErrors(row, seen), ...fieldErrors(row), ...evidenceErrors(row)];
}

export function validateParity(file: ParityFile): string[] {
  const errors: string[] = [];
  if (file.expected_rows !== undefined && file.rows.length !== file.expected_rows) {
    errors.push(`expected ${file.expected_rows} rows, found ${file.rows.length}`);
  }
  const seen = new Set<string>();
  for (const row of file.rows) {
    errors.push(...rowErrors(row, seen));
    seen.add(row.id);
  }
  return errors;
}

export function counts(rows: ParityRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) out.set(row.status, (out.get(row.status) ?? 0) + 1);
  return out;
}
