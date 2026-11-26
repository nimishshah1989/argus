import type { PoolClient } from 'pg';
import type {
  AmcLine,
  EngineData,
  LegalLine,
  ListRow,
  MachineRow,
  PersonRow,
  PmPlanRow,
  ReportRow,
  ShiftRow,
  TaskRow,
  TicketRow,
  WhyWhyRow,
} from '@uptimo/domain';
import {
  isBreakdownChannel,
  resolveFailureCode,
  oemCausePayloadSchema,
  whyWhyPayloadSchema,
  type FailureCodeIndex,
} from '@uptimo/shared';
import {
  createRedactor,
  peopleForEngine,
  personCode,
  redactionTerms,
  tenantInfo,
  type Redactor,
} from '../identity/index.js';
import {
  assetRegistersForEngine,
  failureCodeIndexOf,
  listsForEngine,
  machinesForEngine,
  movesForEngine,
  pmPlansForEngine,
  shiftsForEngine,
} from '../plant/index.js';
import {
  plantEventLines,
  reportsForEngine,
  ticketsForEngine,
  oemCauseEventRows,
  whyWhyEventRows,
} from '../tickets/index.js';
import { readNudgeAcks } from './nudges.js';

type Db = Pick<PoolClient, 'query'>;
type Row = Record<string, unknown>;

const iso = (value: unknown): string | null =>
  value === null || value === undefined ? null : new Date(value as string | Date).toISOString();
const text = (value: unknown): string | null => (value === null ? null : String(value));
/** A money column, which pg reads as a string: null is "not recorded" and a finite number is the rupees. */
const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** The plant has switched this machine to "not counted in production data" (ticket 77a); the flag lives in `metadata`. */
const leftOutByPlant = (row: Row): boolean =>
  (row.metadata as Record<string, unknown> | null)?.excludedFromProduction === true;

const machine = (row: Row): MachineRow => ({
  id: row.id as string,
  code: row.code as string,
  segment: text(row.segment),
  category: text(row.category),
  cell: text(row.cell),
  location: text(row.location),
  make: text(row.make),
  model: text(row.model),
  controller: text(row.controller),
  serial: text(row.serial),
  controllerModel: text(row.controller_model),
  controllerSerial: text(row.controller_serial),
  year: row.year as number | null,
  purchasedOn: text(row.purchased_on),
  powerKw: row.power_kw as number | null,
  capacityKva: row.capacity_kva as number | null,
  assetCode: text(row.asset_code),
  status: row.status as MachineRow['status'],
  criticality: row.criticality as MachineRow['criticality'],
  // The plant files a Robot in its own segment (and the imported master also marks its category Robot): it is never
  // production data. Any other machine is left out only when the plant switched it off in Settings.
  excludedFromProduction:
    row.segment === 'Robot' || row.category === 'Robot' || leftOutByPlant(row),
  metadata: row.metadata as Record<string, unknown>,
});

const ticket = (row: Row): TicketRow => ({
  id: row.id as string,
  ref: row.ref as string,
  kind: row.kind as TicketRow['kind'],
  status: row.status as TicketRow['status'],
  machineId: text(row.machine_id),
  reportedAt: iso(row.reported_at)!,
  closedAt: iso(row.closed_at),
  // Only a live breakdown is `live`; imported, backfilled and planned work is not a live breakdown.
  source: isBreakdownChannel(row.raised_channel as string | null) ? 'live' : 'history',
  downtimeMin: row.downtime_min as number | null,
  repairMin: row.repair_min as number | null,
  workType: text(row.work_type),
  // Ticket 50b: the channel tells planned work from a breakdown, and the scheduled day is the planned job's date.
  raisedChannel: text(row.raised_channel),
  scheduledOn: text(row.task_expected_on),
});

/** One PM plan as the engine reads it (50b): the recurrence's target, interval and clock anchor. */
const pmPlan = (row: Row): PmPlanRow => ({
  id: row.id as string,
  machineId: text(row.machine_id),
  category: text(row.category),
  intervalDays: row.interval_days as number | null,
  createdAt: iso(row.created_at)!,
  lastDoneOn: text(row.last_done_on),
  active: row.active as boolean,
  updatedAt: iso(row.updated_at)!,
});

const task = (row: Row): TaskRow => ({
  ...ticket(row),
  parentId: row.parent_id as string,
  reason: text(row.task_reason),
  expectedOn: text(row.task_expected_on),
});

/** Free text may carry a name or a phone number: it passes the plant's redactor before the engine sees it. */
type Cleaner = (value: string) => string;
const cleanOrNull = (value: unknown, clean: Cleaner): string | null =>
  value === null ? null : clean(String(value));
/** The legacy seed and the loader join a row's spare columns with ", ": the engine reads the parts, not one text. */
const sparesOf = (value: unknown, clean: Cleaner): string[] => {
  const text = cleanOrNull(value, clean);
  return text === null
    ? []
    : text
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '');
};

const cleanerOf =
  (redactor: Redactor): Cleaner =>
  (value) =>
    redactor.redact(value) as string;

const codes = (ids: unknown): string[] => (ids as string[]).map(personCode);

const report = (row: Row, clean: Cleaner, index: FailureCodeIndex): ReportRow => {
  // The platform's three spare costs are one stored sum (0014); the other two slots are unknown, not zero.
  const spareCost = numberOrNull(row.spare_cost);
  const raw = text(row.maint_code);
  return {
    id: row.id as string,
    ticketId: text(row.ticket_id),
    machineId: row.machine_id as string,
    date: row.date as string,
    shift: row.shift_code as string,
    problem: clean(row.problem as string),
    downtimeMin: row.downtime_min as number,
    responseMin: row.response_min as number | null,
    repairMin: row.repair_min as number | null,
    category: text(row.breakdown_category),
    // One code on read: a legacy alias counts beside a new close's code, and an unknown value survives.
    maintCode: raw === null ? null : (resolveFailureCode(index, raw) ?? raw),
    spareUsed: cleanOrNull(row.spare_used, clean),
    spares: sparesOf(row.spare_used, clean),
    rootCause: cleanOrNull(row.root_cause, clean),
    correctiveAction: cleanOrNull(row.corrective_action, clean),
    doneBy: codes(row.done_by),
    supportedBy: codes(row.supported_by),
    observedBy: cleanOrNull(row.observed_by, clean),
    // The plant stores minutes; the legacy recorded-hours column exists only in the old workbook.
    recordedHours: null,
    spareCost,
    spareCosts: spareCost === null ? undefined : [spareCost, null, null],
  };
};

/** The plant events (ticket 91): each event ticket with the machines it stopped and their minutes. */
function plantEventsOf(lines: { ticketId: string; machineId: string; minutes: number }[]) {
  const byTicket = new Map<string, { machineId: string; minutes: number }[]>();
  for (const { ticketId, machineId, minutes } of lines) {
    byTicket.set(ticketId, [...(byTicket.get(ticketId) ?? []), { machineId, minutes }]);
  }
  return [...byTicket].map(([ticketId, eventLines]) => ({ ticketId, lines: eventLines }));
}

/** A Postgres `time` text (`08:00:00`) as minutes from local midnight. */
function minuteOf(value: unknown): number {
  const [hour, minute] = String(value).split(':').map(Number) as [number, number];
  return hour * 60 + minute;
}

const shift = (row: Row): ShiftRow => ({
  code: row.code as string,
  name: row.name as string,
  startMinute: minuteOf(row.starts_at),
  endMinute: minuteOf(row.ends_at),
  crossesMidnight: row.crosses_midnight as boolean,
  active: row.active as boolean,
});

const person = (row: Row): PersonRow => ({
  id: row.id as string,
  code: personCode(row.id as string),
  // The engine holds no name: the live plant's printable form is its pseudonym, never the person's name.
  displayName: personCode(row.id as string),
  team: row.team as PersonRow['team'],
  active: row.active as boolean,
});

/** One saved Why-Why record as the engine reads it: a person code, never the author's id or name. */
function whyWhyRow(row: { ticketId: string; payload: unknown }): WhyWhyRow | null {
  const parsed = whyWhyPayloadSchema.safeParse(row.payload);
  if (!parsed.success) return null;
  const { whys, conclusion, completedBy, completedDate } = parsed.data;
  return {
    ticketId: row.ticketId,
    whys,
    conclusion,
    completedBy: personCode(completedBy),
    completedDate,
  };
}

function listsOf(rows: Row[]): Record<string, ListRow[]> {
  const lists: Record<string, ListRow[]> = {};
  for (const row of rows) {
    (lists[row.list as string] ??= []).push({
      code: row.code as string,
      label: row.label as string,
      active: row.active as boolean,
    });
  }
  return lists;
}

/** R4's one separator between a legal note's name and its form, and the AMC not-renewing suffix (51c, R12). */
const NOTE_SEPARATOR = '·';
const NOT_RENEWING = ' · not renewing';
const AMC_KINDS: ReadonlySet<string> = new Set(['amc', 'warranty']);
const LEGAL_KINDS: ReadonlySet<string> = new Set(['legal', 'calibration']);

/** The AMC type a register note carries back: the note without the flag, or the kind's own label when empty. */
function amcTypeOf(kind: string, note: string): string {
  const type = (note.endsWith(NOT_RENEWING) ? note.slice(0, -NOT_RENEWING.length) : note).trim();
  if (type !== '') return type;
  return kind === 'warranty' ? 'Warranty' : 'AMC';
}

/** A legal note's first `·` segment is the test's name and the rest its form; an empty note has neither (R12). */
function legalPartsOf(note: string): { name: string; form: string | null } {
  const at = note.indexOf(NOTE_SEPARATOR);
  if (at < 0) return { name: note.trim(), form: null };
  return { name: note.slice(0, at).trim(), form: note.slice(at + 1).trim() || null };
}

/** The cleaned note a register row carries: the raw text never reaches a figure, as with `problem` (R12). */
const noteOf = (row: Row, clean: Cleaner): string => cleanOrNull(row.notes, clean) ?? '';

/** One register row as an AMC/warranty line: the stored end, a zero tenure and the row id as the item. */
const registerAmc = (row: Row, clean: Cleaner): AmcLine => {
  const note = noteOf(row, clean);
  return {
    id: row.id as string,
    machineId: (row.machine_id as string | null) ?? '',
    type: amcTypeOf(row.kind as string, note),
    start: text(row.starts_on),
    months: 0,
    vendor: text(row.vendor),
    noRenew: note.endsWith(NOT_RENEWING),
    endsOn: text(row.ends_on) ?? undefined,
    itemKey: row.id as string,
  };
};

/** One register row as a legal/calibration line: the test's name and form back from the note, the stored due. */
const registerLegal = (row: Row, clean: Cleaner): LegalLine => {
  const { name, form } = legalPartsOf(noteOf(row, clean));
  return {
    id: row.id as string,
    machineId: (row.machine_id as string | null) ?? '',
    tid: row.id as string,
    name,
    form,
    last: text(row.starts_on),
    months: 0,
    cert: text(row.reference),
    dueOn: text(row.due_on) ?? undefined,
    itemKey: row.id as string,
  };
};

/**
 * The plant's rows as the engine's plain `data`, read through the plant, tickets and identity interfaces. The
 * transaction is the tenant's (`withTenant`), so only this plant's rows can be read. Everything is loaded, history
 * included; the engine cuts it at its `asOf`. A ticket with a parent is a task; the rest are tickets. No figure may
 * echo free text except as a drill label: names and phones in it are replaced before it reaches the engine.
 */
export async function loadEngineData(tx: Db, tenantId: string): Promise<EngineData> {
  // One connection runs one query at a time, so these are read in turn.
  const { time_zone: timeZone } = await tenantInfo(tx, tenantId);
  const clean = cleanerOf(createRedactor(await redactionTerms(tx, tenantId)));
  const machines = await machinesForEngine(tx);
  const moves = await movesForEngine(tx);
  const shifts = await shiftsForEngine(tx, tenantId);
  const tickets = await ticketsForEngine(tx);
  const reports = await reportsForEngine(tx);
  const people = await peopleForEngine(tx);
  const lists = await listsForEngine(tx);
  const failureIndex = await failureCodeIndexOf(tx, tenantId);
  const savedWhyWhy = await whyWhyEventRows(tx);
  const savedOemCauses = await oemCauseEventRows(tx);
  const plantLines = await plantEventLines(tx);
  const nudgeAcks = await readNudgeAcks(tx);
  const registers = await assetRegistersForEngine(tx, tenantId);
  const pmPlans = await pmPlansForEngine(tx);
  const plantLists = listsOf(lists);
  return {
    timeZone,
    machines: machines.map(machine),
    moves: moves.map((row) => ({
      id: row.id as string,
      machineId: row.machine_id as string,
      fromCell: text(row.from_cell),
      toCell: text(row.to_cell),
      fromLocation: text(row.from_location),
      toLocation: text(row.to_location),
      effectiveFrom: row.effective_from as string,
    })),
    tickets: tickets.filter((row) => row.parent_id === null).map(ticket),
    tasks: tickets.filter((row) => row.parent_id !== null).map(task),
    reports: reports.map((row) => report(row, clean, failureIndex)),
    plantEvents: plantEventsOf(plantLines),
    shifts: shifts.map(shift),
    people: people.map(person),
    // 51c: the register is the live source of the two reminder rules and the workbook's two register sheets.
    amc: registers
      .filter((row) => AMC_KINDS.has(row.kind as string))
      .map((row) => registerAmc(row, clean)),
    legal: registers
      .filter((row) => LEGAL_KINDS.has(row.kind as string))
      .map((row) => registerLegal(row, clean)),
    lists: plantLists,
    // Ticket 50b: every plan, so the engine resolves each machine's own or its category's and reads the tolerance.
    pmPlans: pmPlans.map(pmPlan),
    whyWhy: savedWhyWhy.flatMap((row) => {
      const record = whyWhyRow(row);
      return record ? [record] : [];
    }),
    oemCauses: savedOemCauses.flatMap((row) => {
      const parsed = oemCausePayloadSchema.safeParse(row.payload);
      return parsed.success ? [{ ticketId: row.ticketId, cause: parsed.data.cause }] : [];
    }),
    // The Action Center's saved acks. The figure echoes them whole and the board gives each nudge its status.
    settings: {
      // Left empty: the plant's switch rides on each machine row (`excludedFromProduction`); this list would also
      // change the downtime tiles that read it directly, an open product question (ticket 77a).
      excludedMachineIds: [],
      problemFixes: {},
      nudgeAcks,
      // The report's cell table folds an unlisted cell into "No cell"; the plant's own cell list is the list.
      cells: (plantLists.cell ?? []).map((item) => item.code),
    },
  };
}
