import type { WorkSegment } from '@uptimo/domain';
import { computeTicketFigures, type FigureComputation } from './figures.js';
import { validateIntervals, type ReconciledCrewMember } from './intervals.js';
import { normalizeCode, normalizeKey } from './json.js';
import type { BhavinReport, BhavinTicket, ImportIssue } from './schema.js';
import { reduceTicketState, type ReducedTicket } from './state.js';

export interface CodeReference {
  code: string;
}
export interface WaitReasonReference extends CodeReference {
  isVendor: boolean;
  pausesSla: boolean;
}
export interface ShiftReference extends CodeReference {
  startsAt: string;
  endsAt: string;
  crossesMidnight: boolean;
}
export interface PendingPerson {
  personId: string;
  name: string;
  createdByImport: true;
}
export interface ReconcileReferences {
  timeZone: string;
  machine: {
    id: string;
    code: string;
    category: string | null;
    cell: string | null;
    criticality: 'A' | 'B' | 'C' | null;
  } | null;
  people: ReadonlyMap<string, string>;
  workTypes: ReadonlyMap<string, CodeReference>;
  locations: ReadonlyMap<string, CodeReference>;
  waitReasons: ReadonlyMap<string, WaitReasonReference>;
  breakdownCategories: ReadonlyMap<string, CodeReference>;
  observedBy: ReadonlyMap<string, CodeReference>;
  maintenanceCodes: ReadonlyMap<string, CodeReference>;
  maintenanceAliases: ReadonlyMap<string, string>;
  shifts: ReadonlyMap<string, ShiftReference>;
  pendingPersons: ReadonlyMap<string, PendingPerson>;
}
export interface ReconciledReport {
  machineId: string;
  date: string;
  shiftCode: string;
  problem: string;
  observedBy: string | null;
  correctiveAction: string | null;
  downtimeMin: number;
  responseMin: number | null;
  repairMin: number | null;
  breakdownCategory: string | null;
  maintCode: string | null;
  spareUsed: string | null;
  rootCause: string | null;
  handoverName: string | null;
  submittedByPersonId: string;
  submittedAt: Date;
  doneByPersonIds: string[];
  supportedByPersonIds: string[];
}
export interface ReconciledTicket {
  reduced: ReducedTicket;
  figureResult: FigureComputation;
  crew: ReconciledCrewMember[];
  segments: WorkSegment[];
  reports: ReconciledReport[];
  pendingPersons: PendingPerson[];
}

export class ReconcileError extends Error {
  readonly issues: ImportIssue[];
  constructor(issues: ImportIssue[]) {
    super(issues.map((issue) => issue.message).join('; '));
    this.name = 'ReconcileError';
    this.issues = issues;
  }
}

function structured(ticket: BhavinTicket, code: string, field: string | null, message: string) {
  return {
    rowNumber: 0,
    legacyId: ticket.legacyId,
    ref: ticket.ref,
    code,
    field,
    stored: null,
    computed: null,
    delta: null,
    severity: 'error' as const,
    message,
  };
}

function fail(ticket: BhavinTicket, code: string, field: string | null, message: string): never {
  throw new ReconcileError([structured(ticket, code, field, message)]);
}

function codeRef<T extends CodeReference>(
  map: ReadonlyMap<string, T>,
  value: string,
  field: string,
  ticket: BhavinTicket,
): T {
  const hit = map.get(normalizeCode(value));
  if (!hit) fail(ticket, 'unknown_code', field, `Unknown or inactive ${field}: ${value}`);
  return hit;
}

function person(
  name: string,
  refs: ReconcileReferences,
  ticket: BhavinTicket,
  field: string,
): string {
  const hit = refs.people.get(normalizeKey(name));
  if (!hit) fail(ticket, 'unknown_person', field, `Unknown person: ${name}`);
  return hit;
}

function validateReferences(
  ticket: BhavinTicket,
  reduced: ReducedTicket,
  refs: ReconcileReferences,
): void {
  if (reduced.machineCode !== null && refs.machine === null) {
    fail(ticket, 'unknown_machine', 'machineCode', 'Ticket machine is not resolved');
  }
  if (ticket.workType !== null) codeRef(refs.workTypes, ticket.workType, 'workType', ticket);
  if (ticket.location !== null) codeRef(refs.locations, ticket.location, 'location', ticket);
  if (reduced.state.waitReason !== null) {
    reduced.state.waitReason = codeRef(
      refs.waitReasons,
      reduced.state.waitReason,
      'state.waitReason',
      ticket,
    ).code;
  }
  if (reduced.state.transferToShift !== null) {
    reduced.state.transferToShift = codeRef(
      refs.shifts,
      reduced.state.transferToShift,
      'state.transferToShift',
      ticket,
    ).code;
  }
  ticket.events.forEach((event, seq) => {
    if (event.type === 'transfer' && event.payload.toShift !== null) {
      codeRef(refs.shifts, event.payload.toShift, `events[${seq}].payload.toShift`, ticket);
    }
    if (event.type !== 'pause') return;
    const wait = codeRef(
      refs.waitReasons,
      event.payload.reason,
      `events[${seq}].payload.reason`,
      ticket,
    );
    if (wait.isVendor !== event.payload.isVendor) {
      fail(
        ticket,
        'vendor_mismatch',
        `events[${seq}].payload.isVendor`,
        'Pause isVendor disagrees with wait reason',
      );
    }
  });
}

function localParts(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    seconds: Number(get('hour')) * 3600 + Number(get('minute')) * 60 + Number(get('second')),
  };
}

function shiftSeconds(value: string): number {
  const [hour = 0, minute = 0, second = 0] = value.split(':').map(Number);
  return hour * 3600 + minute * 60 + second;
}

function previousDate(date: string): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() - 1);
  return result.toISOString().slice(0, 10);
}

function validateLocal(input: {
  report: BhavinReport;
  closeAt: Date;
  shift: ShiftReference;
  refs: ReconcileReferences;
  ticket: BhavinTicket;
}): void {
  const { report, closeAt, shift, refs, ticket } = input;
  const local = localParts(closeAt, refs.timeZone);
  const starts = shiftSeconds(shift.startsAt);
  const ends = shiftSeconds(shift.endsAt);
  const belongs = shift.crossesMidnight
    ? local.seconds >= starts || local.seconds < ends
    : local.seconds >= starts && local.seconds < ends;
  if (!belongs)
    fail(ticket, 'report_shift', 'reports[0].shiftCode', 'Close is outside supplied shift');
  const productionDate =
    shift.crossesMidnight && local.seconds <= ends ? previousDate(local.date) : local.date;
  if (report.date !== productionDate) {
    fail(ticket, 'report_date', 'reports[0].date', `Report date must be ${productionDate}`);
  }
}

function reportPeople(
  report: BhavinReport,
  ticket: BhavinTicket,
  refs: ReconcileReferences,
  segments: WorkSegment[],
): { done: string[]; supported: string[] } {
  const done = report.doneBy.map((name) => person(name, refs, ticket, 'reports[0].doneBy'));
  const supported = report.supportedBy.map((name) =>
    person(name, refs, ticket, 'reports[0].supportedBy'),
  );
  if (new Set(done).size !== done.length || new Set(supported).size !== supported.length) {
    fail(ticket, 'duplicate_report_person', 'reports[0].doneBy', 'Duplicate report person');
  }
  if (done.some((id) => supported.includes(id))) {
    fail(
      ticket,
      'cross_listed_report_person',
      'reports[0].supportedBy',
      'Report people must be disjoint',
    );
  }
  if (ticket.entryType === 'ordinary') {
    const expectedDone = new Set(
      segments.filter((s) => s.role !== 'support').map((s) => s.personId),
    );
    const expectedSupport = new Set(
      segments.filter((s) => s.role === 'support').map((s) => s.personId),
    );
    const equal = (actual: string[], expected: Set<string>) =>
      actual.length === expected.size && actual.every((id) => expected.has(id));
    if (!equal(done, expectedDone) || !equal(supported, expectedSupport)) {
      fail(
        ticket,
        'report_people_mismatch',
        'reports[0].doneBy',
        'Report people must match segment roles',
      );
    }
  }
  return { done, supported };
}

function maintenanceCode(
  report: BhavinReport,
  refs: ReconcileReferences,
  ticket: BhavinTicket,
): string | null {
  if (report.maintCode === null) return null;
  const source = normalizeCode(report.maintCode);
  const target = refs.maintenanceAliases.get(source) ?? source;
  return codeRef(refs.maintenanceCodes, target, 'reports[0].maintCode', ticket).code;
}

function projectReport(
  report: BhavinReport,
  ticket: BhavinTicket,
  refs: ReconcileReferences,
  segments: WorkSegment[],
): ReconciledReport {
  if (!refs.machine)
    fail(ticket, 'report_machine', 'reports[0]', 'Report requires a resolved machine');
  const close = ticket.events.find((event) => event.type === 'close');
  if (!close) fail(ticket, 'report_close', 'reports[0]', 'Report requires an original close event');
  const late = ticket.events.find((event) => event.type === 'report');
  const submittedAt = late?.at ?? close.at;
  if (report.submittedAt.getTime() !== submittedAt.getTime()) {
    fail(
      ticket,
      'report_submission',
      'reports[0].submittedAt',
      'Report submission must match close/report event',
    );
  }
  const shift = codeRef(refs.shifts, report.shiftCode, 'reports[0].shiftCode', ticket);
  validateLocal({ report, closeAt: close.at, shift, refs, ticket });
  const people = reportPeople(report, ticket, refs, segments);
  return {
    machineId: refs.machine.id,
    date: report.date,
    shiftCode: shift.code,
    problem: report.problem,
    observedBy:
      report.observedBy === null
        ? null
        : codeRef(refs.observedBy, report.observedBy, 'reports[0].observedBy', ticket).code,
    correctiveAction: report.correctiveAction,
    downtimeMin: report.downtimeMin,
    responseMin: report.responseMin,
    repairMin: report.repairMin,
    breakdownCategory:
      report.breakdownCategory === null
        ? null
        : codeRef(
            refs.breakdownCategories,
            report.breakdownCategory,
            'reports[0].breakdownCategory',
            ticket,
          ).code,
    maintCode: maintenanceCode(report, refs, ticket),
    spareUsed: report.spareUsed,
    rootCause: report.rootCause,
    handoverName: report.handoverName,
    submittedByPersonId: person(report.submittedBy, refs, ticket, 'reports[0].submittedBy'),
    submittedAt: report.submittedAt,
    doneByPersonIds: people.done,
    supportedByPersonIds: people.supported,
  };
}

export function reconcileTicket(
  ticket: BhavinTicket,
  refs: ReconcileReferences,
  now: Date,
): ReconciledTicket {
  try {
    const reduced = reduceTicketState(ticket, now);
    validateReferences(ticket, reduced, refs);
    const { crew, segments } = validateIntervals(ticket, reduced, refs.people);
    const reports = ticket.reports.map((report) => projectReport(report, ticket, refs, segments));
    const figureResult = computeTicketFigures({ ticket, reduced, segments, reports, now });
    if (figureResult.issues.some((issue) => issue.severity === 'error')) {
      throw new ReconcileError(figureResult.issues);
    }
    return {
      reduced,
      figureResult,
      crew,
      segments,
      reports,
      pendingPersons: [...refs.pendingPersons.values()],
    };
  } catch (error) {
    if (error instanceof ReconcileError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new ReconcileError([structured(ticket, 'reconciliation_error', null, message)]);
  }
}
