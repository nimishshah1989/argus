import type { ImportedTicketRow } from '../tickets/index.js';
import type { RealTicket } from './bhavin-export.js';
import { toEvents, toSegments } from './real-events.js';
import { personList, personName, personRole } from './real-people.js';

export interface RowContext {
  /** A name as his app wrote it → the person's id (null for a bare role such as "Operator"). */
  personOf: (raw: string) => string | null;
  machineOf: (code: string) => ImportedTicketRow['machine'];
}

type State = ImportedTicketRow['state'];
const CLOSE_KINDS = new Set(['report', 'no_report', 'done']);

function stateOf(x: RealTicket, c: RowContext): State {
  const cancelled = x.status === 'cancelled';
  return {
    selfStarted: x.selfStarted,
    startedAt: x.startedAt,
    leadPersonId: c.personOf(x.startedBy),
    segmentStartedAt: x.segStart,
    handedOver: x.handedOver,
    handoverSince: x.handoverSince,
    transferToPersonId: c.personOf(x.transferTo),
    transfers: x.transfers,
    waitReason: x.waitReason || null,
    waitSince: x.waitSince,
    pausedByPersonId: c.personOf(x.pausedBy),
    assignedToPersonId: c.personOf(x.assignedTo),
    expectedBackAt: x.eta || null,
    waitingSpare: x.waitSpare ? x.waitReason || null : null,
    machineRunningAt: x.runningAt,
    machineStoppedAt: x.stopAt,
    closedAt: cancelled ? null : x.closedAt,
    closedByPersonId: cancelled ? null : c.personOf(x.closedBy),
    closeKind: CLOSE_KINDS.has(x.closeKind) ? (x.closeKind as State['closeKind']) : null,
    closeNote: x.closeNote || null,
    cancelledAt: cancelled ? x.closedAt : null,
    taskReason: x.taskWhy || null,
    taskExpectedOn: x.taskExp || null,
    taskDownMin: x.taskDownMin,
    editedAt: x.editedAt,
  };
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

function reportOf(x: RealTicket, c: RowContext): ImportedTicketRow['report'] {
  const r = x.report;
  if (!r || typeof r.sh !== 'string' || typeof r.d !== 'string' || x.kind === 'general')
    return null;
  const late = x.events.find((e) => e.type === 'report');
  const ids = (value: unknown): string[] =>
    typeof value === 'string' ? personList(value).map((n) => c.personOf(n) as string) : [];
  return {
    date: r.d,
    shiftCode: r.sh,
    problem: text(r.pr) ?? x.problem,
    observedBy: text(r.ob),
    correctiveAction: text(r.ca),
    downtimeMin: typeof r.dm === 'number' ? r.dm : 0,
    responseMin: typeof r.rs === 'number' ? r.rs : null,
    repairMin: typeof r.rp === 'number' ? r.rp : null,
    breakdownCategory: text(r.bc),
    maintCode: text(r.mc),
    spareUsed: text(r.sp),
    rootCause: null,
    handoverName: null,
    submittedByPersonId: c.personOf(x.closedBy),
    submittedAt: late?.at ?? x.closedAt,
    doneByPersonIds: ids(r.db),
    supportedByPersonIds: ids(r.sb),
  };
}

export function toRow(x: RealTicket, c: RowContext): ImportedTicketRow {
  return {
    ref: x.ref,
    kind: x.kind,
    status: x.status,
    channel: 'import',
    machine: x.kind === 'general' ? null : c.machineOf(x.machine),
    location: x.location || null,
    workType: x.workType || null,
    urgent: x.urgent,
    problem: x.problem,
    reportedAt: x.downAt,
    reportedByPersonId: c.personOf(x.reportedBy),
    reportedByRole: personRole(x.reportedBy),
    state: stateOf(x, c),
    figures: {
      responseMin: x.responseMin,
      activeMin: x.activeMin,
      waitMin: x.waitMin,
      vendorMin: x.vendorMin,
      handoverWaitMin: x.handoverWaitMin,
      downAccMin: x.downAcc,
      downtimeMin: x.downtimeMin,
      followMin: x.followMin,
      repairMin: x.repairMin,
    },
    events: toEvents(x, c.personOf),
    crew: x.crew.flatMap((m) => {
      const id = c.personOf(m.name);
      return id
        ? [
            {
              personId: id,
              role: m.role === 'support' ? ('support' as const) : ('primary' as const),
              joinedAt: m.joinedAt,
              leftAt: m.left,
              leftReason: m.leftWhy || null,
            },
          ]
        : [];
    }),
    segments: toSegments(x, c.personOf),
    report: reportOf(x, c),
  };
}

/** Every person name a ticket mentions, as Bhavin's app wrote it (roles stripped, lists split). */
export function namesIn(x: RealTicket): string[] {
  const names = new Set<string>();
  const add = (raw: string): void => {
    const name = personName(raw);
    if (name) names.add(name);
  };
  for (const raw of [x.reportedBy, x.startedBy, x.closedBy, x.assignedTo, x.transferTo, x.pausedBy])
    add(raw);
  for (const e of x.events) add(e.by);
  for (const m of x.crew) add(m.name);
  for (const key of ['db', 'sb']) {
    const value = x.report?.[key];
    if (typeof value === 'string') personList(value).forEach(add);
  }
  return [...names];
}
