/**
 * The 2026 breakdown log as a synthetic import export.
 *
 * Seed tooling, not a test helper: the staging load uses it. It emits the same `argus.synthetic-bhavin/v1`
 * contract the importer parses. Deterministic (no clock, no random) and identity aliases over the exported
 * rows' doneBy names, so a missing master row stays an import issue instead of a silent rename.
 *
 * The 60 `bd_live_` rows are not tickets here: each already carries its real `ticketRef` and is a live ticket,
 * so the export is the other 1,283 rows and the load leaves the 60 to their live tickets.
 *
 * Refs sit in a synthetic band: `BD-9` prefixed to the srNo (four digits, `BD-90001`…`BD-91357`). The plant's
 * live refs are `BD-0001`…`BD-0151`; `advanceRefCounters` raises the live BD counter to `BD-91287` when the
 * import commits. That consequence is recorded, not hidden.
 *
 * Shift placement: the seed holds two windows, `1` 08:00-18:30 and `2` 18:29-05:00. `1ST` is `1`, `2ND` is
 * `2`, and `3` folds into `2` (the night window; the platform's third choice has no seeded row and Q8 is
 * open). A ticket ends two hours into its named shift on the row's plant date, so the close is always inside
 * the window `validateLocal` checks and `report.date` is that date. `reportedAt` is the close minus the row's
 * downtime, so a long downtime starts days earlier and its clock time can fall outside a window; reconcile
 * only checks the close. The row's exact downtime survives through the import's report overrides, so
 * `closed_at` is approximate.
 */
export type AliasMap = Record<string, string>;

/** The same shape as `SyntheticExport` in modules/imports/schema.ts; seed code may not import module internals. */
export interface SyntheticExport {
  source: 'argus.synthetic-bhavin/v1';
  aliases: { machines: AliasMap; people: AliasMap; maintenanceCodes: AliasMap };
  tickets: unknown[];
}

interface BreakdownRow {
  id: string;
  machineId: string;
  date: string;
  shift: string;
  problem: string;
  observedBy: string;
  correctiveAction: string;
  doneBy: string;
  supportedBy: string;
  downMin: number;
  respMin: number;
  maintCode: string;
  electMech: string;
  spare1: string;
  spare2: string;
  spare3: string;
  srNo: number;
}

const SOURCE = 'argus.synthetic-bhavin/v1' as const;
const LIVE_ROW_PREFIX = 'bd_live_';
export const PLANT_OFFSET = '+05:30';
export const SUBMITTER_FALLBACK = 'Maint. Team';
export const NO_PROBLEM_TEXT = 'Breakdown recorded without a problem description';
const REF_BAND = 90_000;
export const CLOSE_INTO_SHIFT_MIN = 120;
/** The two seeded windows (`cosmos-shifts.json`); the close lands two hours after the start. */
export const SHIFT_START: Record<string, string> = {
  '1': '08:00',
  '2': '18:29',
};
/**
 * `3` has no seeded shift row, so it folds into the night window `2` until Q8 settles the platform's third
 * choice. `1ST` and `2ND` are the same windows under another name.
 */
const SHIFT_CODES: AliasMap = {
  '1': '1',
  '1ST': '1',
  '2': '2',
  '2ND': '2',
  '3': '2',
};
/**
 * The active `observed_by` list's codes. The history spells `Operator` three ways; a person name in that
 * column is not a code, so it stays null instead of becoming a guessed list item.
 */
export const OBSERVED_BY: AliasMap = {
  operator: 'Operator',
  opeartor: 'Operator',
  opeator: 'Operator',
  setter: 'Setter',
  supervisor: 'Supervisor',
  engineer: 'Engineer',
};
/**
 * The synthetic maintenance-code map, not the plant's.
 * N12 (open, Bhavin) and the Q9 proposal: the history uses NI, FS, PP and UTI, which the seed does not hold;
 * MEC and INT are kept for the same proposal. It is a config line to replace when N12 lands.
 */
const MAINTENANCE_CODE_ALIASES: AliasMap = {
  MEC: 'M',
  NI: 'MIS',
  INT: 'MIS',
  FS: 'MIS',
  PP: 'MIS',
  UTI: 'MIS',
};

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readInteger(value: unknown, field: string, min: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new Error(`breakdown log row has an invalid ${field}: ${String(value)}`);
  }
  return value;
}

function readOptionalInteger(value: unknown, field: string): number {
  if (value === undefined || value === null || value === '') return 0;
  return readInteger(value, field, 0);
}

function readRow(value: unknown, index: number): BreakdownRow {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`breakdown log row ${index} is not an object`);
  }
  const row = value as Record<string, unknown>;
  const id = readText(row.id);
  const machineId = readText(row.machineId);
  if (!id || !machineId) throw new Error(`breakdown log row ${index} needs id and machineId`);
  return {
    id,
    machineId,
    date: readText(row.date),
    shift: readText(row.shift),
    problem: readText(row.problem),
    observedBy: readText(row.observedBy),
    correctiveAction: readText(row.correctiveAction),
    doneBy: readText(row.doneBy),
    supportedBy: readText(row.supportedBy),
    downMin: readInteger(row.downMin, 'downMin', 0),
    respMin: readOptionalInteger(row.respMin, 'respMin'),
    maintCode: readText(row.maintCode),
    electMech: readText(row.electMech),
    spare1: readText(row.spare1),
    spare2: readText(row.spare2),
    spare3: readText(row.spare3),
    srNo: readInteger(row.srNo, 'srNo', 1),
  };
}

function readRows(input: unknown): BreakdownRow[] {
  if (typeof input !== 'object' || input === null) {
    throw new Error('breakdown log input is not an object');
  }
  const breakdowns = (input as { breakdowns?: unknown }).breakdowns;
  if (!Array.isArray(breakdowns)) throw new Error('breakdown log input has no breakdowns array');
  return breakdowns.map(readRow);
}

export function normalizeKey(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

function normalizeCode(value: string): string {
  return normalizeKey(value).toUpperCase();
}

function splitNames(value: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of value.split(',')) {
    const name = part.trim();
    const key = normalizeKey(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function calendarDate(row: BreakdownRow): string {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(row.date);
  if (!match) throw new Error(`breakdown ${row.id} has a non-DD-MM-YYYY date: ${row.date}`);
  return `${match[3] ?? ''}-${match[2] ?? ''}-${match[1] ?? ''}`;
}

function shiftOf(row: BreakdownRow): { code: string; startsAt: string } {
  const code = SHIFT_CODES[row.shift];
  const startsAt = code ? SHIFT_START[code] : undefined;
  if (!code || !startsAt) {
    throw new Error(`breakdown ${row.id} has an unsupported shift: ${row.shift}`);
  }
  return { code, startsAt };
}

function closedAt(row: BreakdownRow): string {
  const start = `${calendarDate(row)}T${shiftOf(row).startsAt}:00${PLANT_OFFSET}`;
  return addMinutes(start, CLOSE_INTO_SHIFT_MIN);
}

export function addMinutes(at: string, minutes: number): string {
  return new Date(Date.parse(at) + minutes * 60_000).toISOString();
}

/** `BD-9` then the srNo padded to four: BD-90001…BD-91357. A duplicate srNo steps one number in the same band. */
function ticketRefs(rows: readonly BreakdownRow[]): string[] {
  const used = new Set<string>();
  return rows.map((row) => {
    let suffix = REF_BAND + row.srNo;
    while (used.has(`BD-${suffix}`)) suffix += 1;
    const ref = `BD-${suffix}`;
    used.add(ref);
    return ref;
  });
}

function identityAliases(byNormalized: ReadonlyMap<string, string>): AliasMap {
  return Object.fromEntries(
    [...byNormalized.entries()]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([, name]) => [name, name]),
  );
}

function machineAliases(rows: readonly BreakdownRow[]): AliasMap {
  const byNormalized = new Map<string, string>();
  for (const row of rows) {
    const key = normalizeCode(row.machineId);
    if (!byNormalized.has(key)) byNormalized.set(key, row.machineId);
  }
  return identityAliases(byNormalized);
}

function peopleAliases(rows: readonly BreakdownRow[]): AliasMap {
  const byNormalized = new Map<string, string>();
  let needsFallback = false;
  for (const row of rows) {
    const names = splitNames(row.doneBy);
    if (names.length === 0) needsFallback = true;
    for (const name of names) {
      const key = normalizeKey(name);
      if (!byNormalized.has(key)) byNormalized.set(key, name);
    }
  }
  const fallbackKey = normalizeKey(SUBMITTER_FALLBACK);
  if (needsFallback && !byNormalized.has(fallbackKey)) {
    byNormalized.set(fallbackKey, SUBMITTER_FALLBACK);
  }
  return identityAliases(byNormalized);
}

export function figuresFor(responseMin: number, downMin: number): Record<string, unknown> {
  return {
    responseMin,
    activeMin: 0,
    waitMin: 0,
    vendorMin: 0,
    handoverWaitMin: 0,
    downAccMin: 0,
    downtimeMin: downMin,
    followMin: null,
    repairMin: downMin - responseMin,
  };
}

export function stateFor(closedAt: string, submittedBy: string): Record<string, unknown> {
  return {
    selfStarted: false,
    startedAt: null,
    segmentStartedAt: null,
    leadPerson: null,
    handedOver: false,
    handoverSince: null,
    transferToPerson: null,
    transferToShift: null,
    transfers: 0,
    waitReason: null,
    waitSince: null,
    pausedByPerson: null,
    assignedToPerson: null,
    expectedBackAt: null,
    waitingSpare: null,
    machineRunningAt: null,
    machineStoppedAt: null,
    kindUpgradedAt: null,
    closedAt,
    closedByPerson: submittedBy,
    closeKind: 'report',
    closeNote: null,
    cancelledAt: null,
  };
}

function reportFor(input: {
  row: BreakdownRow;
  submittedAt: string;
  doneBy: string[];
  supportedBy: string[];
  submittedBy: string;
  responseMin: number;
}): Record<string, unknown> {
  const { row, submittedAt, doneBy, supportedBy, submittedBy, responseMin } = input;
  const spare = [row.spare1, row.spare2, row.spare3].filter(Boolean).join(', ');
  return {
    kind: 'breakdown',
    problem: row.problem || NO_PROBLEM_TEXT,
    date: calendarDate(row),
    shiftCode: shiftOf(row).code,
    observedBy: OBSERVED_BY[normalizeKey(row.observedBy)] ?? null,
    correctiveAction: row.correctiveAction || null,
    downtimeMin: row.downMin,
    responseMin,
    repairMin: row.downMin - responseMin,
    breakdownCategory: row.electMech || null,
    maintCode: row.maintCode || null,
    spareUsed: spare || null,
    rootCause: null,
    handoverName: null,
    doneBy,
    supportedBy,
    submittedAt,
    submittedBy,
  };
}

function ticketFor(row: BreakdownRow, ref: string): Record<string, unknown> {
  const close = closedAt(row);
  const at = addMinutes(close, -row.downMin);
  const doneBy = splitNames(row.doneBy);
  // Two source rows name a person in both columns (one twice in doneBy). The schema and reconcile require
  // disjoint, de-duplicated people, so doneBy keeps the role and the repeated support mention is dropped.
  const doneKeys = new Set(doneBy.map(normalizeKey));
  const supportedBy = splitNames(row.supportedBy).filter(
    (name) => !doneKeys.has(normalizeKey(name)),
  );
  const submittedBy = doneBy[0] ?? SUBMITTER_FALLBACK;
  const responseMin = row.respMin;
  return {
    legacyId: row.id,
    ref,
    entryType: 'pastBreakdown',
    kind: 'stopped',
    status: 'closed',
    machineCode: row.machineId,
    location: null,
    workType: null,
    problem: row.problem || NO_PROBLEM_TEXT,
    reportedAt: at,
    reportedByPerson: null,
    parentRef: null,
    state: stateFor(close, submittedBy),
    events: [
      { type: 'down', at, by: null, text: null, payload: {} },
      { type: 'close', at: close, by: submittedBy, text: null, payload: { kind: 'report' } },
    ],
    crew: [],
    segments: [],
    reports: [
      reportFor({ row, submittedAt: close, doneBy, supportedBy, submittedBy, responseMin }),
    ],
    storedFigures: figuresFor(responseMin, row.downMin),
  };
}

export function breakdownLogExport(input: unknown): SyntheticExport {
  const rows = readRows(input).filter((row) => !row.id.startsWith(LIVE_ROW_PREFIX));
  const refs = ticketRefs(rows);
  return {
    source: SOURCE,
    aliases: {
      machines: machineAliases(rows),
      people: peopleAliases(rows),
      maintenanceCodes: { ...MAINTENANCE_CODE_ALIASES },
    },
    tickets: rows.map((row, index) => {
      const ref = refs[index];
      if (!ref) throw new Error(`breakdown log row ${index} has no reference`);
      return ticketFor(row, ref);
    }),
  };
}
