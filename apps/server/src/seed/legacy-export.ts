import {
  CLOSE_INTO_SHIFT_MIN,
  NO_PROBLEM_TEXT,
  OBSERVED_BY,
  PLANT_OFFSET,
  SHIFT_START,
  SUBMITTER_FALLBACK,
  addMinutes,
  figuresFor,
  normalizeKey,
  stateFor,
  type AliasMap,
  type SyntheticExport,
} from './breakdown-log-export.js';
import {
  classifyLegacy,
  isPm,
  type ClassifiedRow,
  type Switches,
  type YearReport,
} from './legacy-classify.js';
import { IMPORT_LIMITS } from '../modules/imports/index.js';
import { createPeople, type People, type PlantPerson } from './legacy-people.js';
import type { LegacyRow } from './legacy-sheets.js';

/**
 * Legacy workbooks, step three: classified rows become one `argus.synthetic-bhavin/v1` file per workbook year.
 * A ticket is a past breakdown placed as 37c placed them (R13); the utility rows of one plant date become one
 * closed general ticket with a `utility_loss` line per machine (R20). Deterministic: no clock, no random.
 */
export interface PlantContext {
  machines: ReadonlySet<string>;
  people: readonly PlantPerson[];
  /** The tenant's redaction terms: any of them left in an output refuses the write. */
  terms: readonly string[];
}
export interface YearFile {
  year: number;
  json: string;
  tickets: number;
  events: number;
}

const SHIFT_FOLD: Record<string, string> = {
  '1': '1',
  '1ST': '1',
  '1STG': '1',
  '1TS': '1',
  '2': '2',
  '2ND': '2',
  '2D': '2',
  '3': '2',
  '3RD': '2',
  '3ND': '2',
};
const EPOCH = Date.UTC(2022, 0, 1);

const shiftOf = (raw: string): { code: string; stray: boolean } => {
  const code = SHIFT_FOLD[raw];
  return code ? { code, stray: false } : { code: '1', stray: true };
};
const closeOf = (date: string, shift: string): string =>
  addMinutes(`${date}T${SHIFT_START[shift] ?? '08:00'}:00${PLANT_OFFSET}`, CLOSE_INTO_SHIFT_MIN);

function ticket(c: ClassifiedRow, people: People, fold: AliasMap): Record<string, unknown> {
  const { row } = c;
  const date = row.date ?? '';
  const shift = shiftOf(row.shift);
  const close = closeOf(date, shift.code);
  const at = addMinutes(close, -row.minutes);
  const doneBy = people.codesOf(row.doneBy);
  const by = doneBy[0] ?? SUBMITTER_FALLBACK;
  const pm = isPm(row);
  const code = pm ? 'PM' : (fold[row.code] ?? row.code);
  const problem = people.redact(row.problem).slice(0, 4096) || NO_PROBLEM_TEXT;
  const action = people.redact(row.correctiveAction).slice(0, 4096);
  return {
    legacyId: `lg-${row.year}-${pm ? 'pm' : 'bd'}-${c.machine}-${row.excelRow}`,
    ref: `BD-${row.year % 10}${String(c.serial).padStart(4, '0')}`,
    entryType: 'pastBreakdown',
    kind: 'stopped',
    status: 'closed',
    machineCode: c.machine,
    location: null,
    workType: null,
    problem,
    reportedAt: at,
    reportedByPerson: null,
    parentRef: null,
    state: stateFor(close, by),
    events: [
      { type: 'down', at, by: null, text: null, payload: {} },
      { type: 'close', at: close, by, text: null, payload: { kind: 'report' } },
    ],
    crew: [],
    segments: [],
    reports: [
      {
        kind: 'breakdown',
        problem,
        date,
        shiftCode: shift.code,
        observedBy: OBSERVED_BY[normalizeKey(row.observedBy)] ?? null,
        correctiveAction: action || null,
        downtimeMin: row.minutes,
        responseMin: 0,
        repairMin: row.minutes,
        breakdownCategory: row.elecMech === 'E' || row.elecMech === 'M' ? row.elecMech : null,
        maintCode: code || null,
        spareUsed: null,
        rootCause: null,
        handoverName: null,
        doneBy,
        supportedBy: [],
        submittedAt: close,
        submittedBy: by,
      },
    ],
    storedFigures: figuresFor(0, row.minutes),
  };
}

const lossMinutes = (row: LegacyRow): number =>
  row.utiHours > 0 ? Math.round(row.utiHours * 60) : row.minutes;

/** One plant event: a closed general ticket, one `utility_loss` line per machine row of the date (R20). */
function plantEvent(
  plantDay: { year: number; date: string; lines: readonly ClassifiedRow[] },
  people: People,
  fold: AliasMap,
): Record<string, unknown> {
  const { year, date, lines } = plantDay;
  const longest = Math.max(0, ...lines.map((l) => lossMinutes(l.row)));
  const close = closeOf(date, '1');
  const at = addMinutes(close, -longest);
  const texts = new Map<string, number>();
  for (const l of lines) {
    const text = people.redact(l.row.problem).slice(0, 4096);
    if (text) texts.set(text, (texts.get(text) ?? 0) + 1);
  }
  const common = [...texts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0];
  const day = Math.round((Date.parse(`${date}T00:00:00Z`) - EPOCH) / 86_400_000) + 1;
  return {
    legacyId: `lg-${year}-uti-${date}`,
    ref: `WR-${year % 10}${String(day).padStart(4, '0')}`,
    entryType: 'pastUtility',
    kind: 'general',
    status: 'closed',
    machineCode: null,
    location: 'Plant',
    workType: 'Utility failure',
    problem: common ?? 'Utility failure',
    reportedAt: at,
    reportedByPerson: null,
    parentRef: null,
    state: { ...stateFor(close, ''), closedByPerson: null, closeKind: 'done' },
    events: [
      { type: 'down', at, by: null, text: null, payload: {} },
      ...lines.map((l) => ({
        type: 'utility_loss',
        at,
        by: null,
        text: null,
        payload: {
          machineCode: l.machine,
          minutes: lossMinutes(l.row),
          code: (fold[l.row.code] ?? l.row.code) || null,
        },
      })),
      { type: 'close', at: close, by: null, text: null, payload: { kind: 'done' } },
    ],
    crew: [],
    segments: [],
    reports: [],
    storedFigures: { ...figuresFor(0, 0), responseMin: null, followMin: null },
  };
}

const identity = (values: Iterable<string>): AliasMap =>
  Object.fromEntries([...new Set(values)].sort().map((value) => [value, value]));

function yearExport(
  rows: readonly ClassifiedRow[],
  year: number,
  people: People,
  fold: AliasMap,
): { out: SyntheticExport; tickets: number; events: number; codes: Set<string> } {
  const own = rows.filter((c) => c.row.year === year);
  const tickets = own.filter((c) => c.cls === 'ticket').map((c) => ticket(c, people, fold));
  const days = new Map<string, ClassifiedRow[]>();
  for (const c of own.filter((x) => x.cls === 'utility')) {
    days.set(c.row.date ?? '', [...(days.get(c.row.date ?? '') ?? []), c]);
  }
  const events = [...days]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([d, l]) => plantEvent({ year, date: d, lines: l }, people, fold));
  const all = [...tickets, ...events] as Array<Record<string, unknown>>;
  const reports = all.flatMap((t) => (t.reports as Array<Record<string, unknown>>) ?? []);
  const named = reports.flatMap((r) => [...(r.doneBy as string[]), r.submittedBy as string]);
  const codeList = reports.map((r) => r.maintCode as string | null).filter((c): c is string => !!c);
  const lineCodes = events.flatMap((e) =>
    (e.events as Array<{ payload: { code?: string | null } }>).map((x) => x.payload.code ?? ''),
  );
  const used = [...own.filter((c) => c.cls === 'ticket' || c.cls === 'utility')];
  const out: SyntheticExport = {
    source: 'argus.synthetic-bhavin/v1',
    aliases: {
      machines: identity(used.map((c) => c.machine)),
      people: identity(named),
      maintenanceCodes: identity([...codeList, ...lineCodes.filter(Boolean)]),
    },
    tickets: all,
  };
  return { out, tickets: tickets.length, events: events.length, codes: new Set(named) };
}

/** The proof that no name reaches a file: a leaked name word, or a tenant term, refuses the write (R10). */
function assertClean(json: string, year: number, people: People, terms: readonly string[]): void {
  const lower = json.toLowerCase();
  const leaked =
    people.leaks(json) + terms.filter((t) => t && lower.includes(t.toLowerCase())).length;
  if (leaked > 0)
    throw new Error(
      `legacy ${year}: ${leaked} name token(s) would reach the file; refusing to write`,
    );
}

export function convertLegacy(
  rows: readonly LegacyRow[],
  plant: PlantContext,
  switches: Switches,
): { files: YearFile[]; reports: YearReport[] } {
  const { rows: classified, reports } = classifyLegacy(rows, plant.machines, switches);
  const people = createPeople(
    plant.people,
    plant.terms,
    rows.flatMap((r) => [r.doneBy, r.observedBy]),
  );
  const files = reports.map((report): YearFile => {
    const built = yearExport(classified, report.year, people, switches.fold);
    const json = JSON.stringify(built.out);
    if (built.out.tickets.length > IMPORT_LIMITS.tickets) {
      throw new Error(
        `legacy ${report.year}: ${built.out.tickets.length} tickets exceed the file cap`,
      );
    }
    if (Buffer.byteLength(json) > IMPORT_LIMITS.fileBytes)
      throw new Error(`legacy ${report.year}: file too large`);
    // The contract name `argus.synthetic-bhavin/v1` is not data: only aliases and tickets are checked.
    assertClean(
      JSON.stringify([built.out.aliases, built.out.tickets]),
      report.year,
      people,
      plant.terms,
    );
    report.events = built.events;
    report.possibleDuplicatePeople = people.possibleDuplicates(built.codes);
    report.strayShift = classified.filter(
      (c) => c.row.year === report.year && c.cls === 'ticket' && shiftOf(c.row.shift).stray,
    ).length;
    return { year: report.year, json, tickets: built.tickets, events: built.events };
  });
  return { files, reports };
}
