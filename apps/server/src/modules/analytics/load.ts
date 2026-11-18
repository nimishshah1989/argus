import type { PoolClient } from 'pg';
import type {
  EngineData,
  ListRow,
  MachineRow,
  PersonRow,
  ReportRow,
  TaskRow,
  TicketRow,
  WhyWhyRow,
} from '@uptimo/domain';
import {
  isBreakdownChannel,
  resolveFailureCode,
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
  failureCodeIndexOf,
  listsForEngine,
  machinesForEngine,
  movesForEngine,
} from '../plant/index.js';
import { reportsForEngine, ticketsForEngine, whyWhyEventRows } from '../tickets/index.js';
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
  // production data. A machine a plant excludes by hand has no column yet; that is an additive follow-up.
  excludedFromProduction: row.segment === 'Robot' || row.category === 'Robot',
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
  const tickets = await ticketsForEngine(tx);
  const reports = await reportsForEngine(tx);
  const people = await peopleForEngine(tx);
  const lists = await listsForEngine(tx);
  const failureIndex = await failureCodeIndexOf(tx, tenantId);
  const savedWhyWhy = await whyWhyEventRows(tx);
  const nudgeAcks = await readNudgeAcks(tx);
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
    people: people.map(person),
    lists: plantLists,
    whyWhy: savedWhyWhy.flatMap((row) => {
      const record = whyWhyRow(row);
      return record ? [record] : [];
    }),
    // The Action Center's saved acks. The figure echoes them whole and the board gives each nudge its status.
    settings: {
      excludedMachineIds: [],
      problemFixes: {},
      nudgeAcks,
      // The report's cell table folds an unlisted cell into "No cell"; the plant's own cell list is the list.
      cells: (plantLists.cell ?? []).map((item) => item.code),
    },
  };
}
