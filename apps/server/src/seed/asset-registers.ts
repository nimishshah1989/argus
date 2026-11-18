import { addMonths, endOfTerm } from '@uptimo/domain';

/**
 * The 11 November workbook's AMC/Warranty and Legal Compliance sheets as `asset_register` drafts (ticket 51a, R2).
 * Pure: the seed reads the fixture, this file decides every field and the plant repo writes it. R1 classifies by the
 * line's own words, R3 stores dates (never tenure) and R4 carries the type/test/not-renewing text in `notes`.
 */

export type RegisterKind = 'amc' | 'warranty' | 'legal' | 'calibration';

export interface RegisterAmcLine {
  machineId?: string;
  type?: string;
  start?: string;
  months?: number;
  vendor?: string;
  noRenew?: boolean;
}

export interface RegisterLegalLine {
  machineId?: string;
  tid?: string;
  name?: string;
  form?: string;
  last?: string;
  months?: number;
  cert?: string;
}

export interface RegisterLegalType {
  id?: string;
  name?: string;
  form?: string;
  months?: number;
}

export interface RegisterSettings {
  machAmc?: readonly RegisterAmcLine[];
  machLegal?: readonly RegisterLegalLine[];
  /** The AMC contract-type vocabulary; it classifies, it never becomes a row (R5). */
  amcTypes?: readonly string[];
  /** The legal type's name/form/months fallback, looked up by the line's `tid` (R5). */
  legalTypes?: readonly RegisterLegalType[];
}

export interface RegisterWorkbook {
  settings?: RegisterSettings;
}

export interface AssetRegisterDraft {
  /** The machine's register code; the seed resolves it to the machine's id. */
  machineCode: string;
  kind: RegisterKind;
  vendor: string | null;
  reference: string | null;
  startsOn: string | null;
  /** `endOfTerm(start, months)`; null when the line has no start. */
  endsOn: string | null;
  /** `addMonths(last, months)` for a legal line; null when it has no last date. */
  dueOn: string | null;
  leadDays: number;
  /** R4's convention: the AMC type, or the legal test name and form. */
  notes: string | null;
}

export interface AssetRegisterCounts {
  amc: number;
  warranty: number;
  legal: number;
  calibration: number;
}

export interface AssetRegisterMapping {
  items: AssetRegisterDraft[];
  counts: AssetRegisterCounts;
  /** A source line that names no machine: skipped, never a failed seed. */
  conflicts: string[];
}

/** R4's one separator between a legal note's name and its form (and the AMC not-renewing suffix). */
export const NOTE_SEPARATOR = '·';
export const NOT_RENEWING = ' · not renewing';

/** R1: the AMC/Warranty sheet's own words decide warranty or amc. */
const WARRANTY = /warranty|extended|\bEWC\b|\bFOC\b/i;
/** R1: a legal name/form that says calibration is one, everything else on that sheet is a statutory test. */
const CALIBRATION = /calibrat/i;

const text = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
};

const monthsOf = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;

export function amcKind(type: string): RegisterKind {
  return WARRANTY.test(type) ? 'warranty' : 'amc';
}

export function legalKind(name: string, form: string): RegisterKind {
  return CALIBRATION.test(`${name} ${form}`) ? 'calibration' : 'legal';
}

/** R4: `<type>` or `<type> · not renewing`; an empty type keeps the flag readable by R12. */
function amcNotes(type: string | null, noRenew: boolean): string | null {
  if (!noRenew) return type;
  return `${type ?? ''}${NOT_RENEWING}`;
}

/** R4's legal note: `<name> · <form>`, and whichever half the line has when it has only one. */
function legalNotes(name: string | null, form: string | null): string | null {
  if (name === null) return form === null ? null : ` ${NOTE_SEPARATOR} ${form}`;
  return form === null ? name : `${name} ${NOTE_SEPARATOR} ${form}`;
}

function amcDraft(
  line: RegisterAmcLine,
  machineCode: string,
  leadDays: number,
): AssetRegisterDraft {
  const type = text(line.type);
  const startsOn = text(line.start);
  const months = monthsOf(line.months);
  return {
    machineCode,
    kind: amcKind(type ?? ''),
    vendor: text(line.vendor),
    reference: null,
    startsOn,
    endsOn: startsOn !== null && months > 0 ? endOfTerm(startsOn, months) : null,
    dueOn: null,
    leadDays,
    notes: amcNotes(type, line.noRenew === true),
  };
}

function legalDraft(
  line: RegisterLegalLine,
  machineCode: string,
  types: Map<string | undefined, RegisterLegalType>,
  leadDays: number,
): AssetRegisterDraft {
  const type = line.tid ? types.get(line.tid) : undefined;
  const name = text(line.name) ?? text(type?.name);
  const form = text(line.form) ?? text(type?.form);
  const startsOn = text(line.last);
  const months = monthsOf(line.months) || monthsOf(type?.months);
  return {
    machineCode,
    kind: legalKind(name ?? '', form ?? ''),
    vendor: null,
    reference: text(line.cert),
    startsOn,
    endsOn: null,
    dueOn: startsOn !== null && months > 0 ? addMonths(startsOn, months) : null,
    leadDays,
    notes: legalNotes(name, form),
  };
}

export function mapAssetRegisters(
  workbook: RegisterWorkbook,
  options: { defaultLeadDays: number },
): AssetRegisterMapping {
  const settings = workbook.settings ?? {};
  const types = new Map((settings.legalTypes ?? []).map((type) => [type.id, type]));
  const leadDays = Math.max(0, Math.trunc(options.defaultLeadDays));
  const items: AssetRegisterDraft[] = [];
  const conflicts: string[] = [];
  let sourceRow = 0;
  const push = (
    line: { machineId?: string },
    build: (machineCode: string) => AssetRegisterDraft,
  ): void => {
    sourceRow += 1;
    const machineCode = text(line.machineId);
    if (machineCode === null) {
      conflicts.push(`register line ${sourceRow} has no machine`);
      return;
    }
    items.push(build(machineCode));
  };

  for (const line of settings.machAmc ?? []) {
    push(line, (machineCode) => amcDraft(line, machineCode, leadDays));
  }
  for (const line of settings.machLegal ?? []) {
    push(line, (machineCode) => legalDraft(line, machineCode, types, leadDays));
  }

  const counts: AssetRegisterCounts = { amc: 0, warranty: 0, legal: 0, calibration: 0 };
  for (const item of items) counts[item.kind] += 1;
  return { items, counts, conflicts };
}
