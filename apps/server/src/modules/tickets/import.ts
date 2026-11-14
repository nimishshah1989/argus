import { computeSeverity } from '@uptimo/domain';
import type { PoolClient } from 'pg';
import {
  insertImportedCrew,
  insertImportedEvent,
  insertImportedReport,
  insertImportedSegment,
  insertImportedTicket,
  insertReportPerson,
} from './repo/imported.js';
import { loadSeverityMatrix } from './severity.js';

type When = Date | string | null;

/** One ticket as it is written into history: people are already person ids, times are instants. */
export interface ImportedTicketRow {
  ref: string;
  kind: 'stopped' | 'support' | 'general';
  status: 'open' | 'working' | 'waiting' | 'closed' | 'cancelled';
  /** `backfill` for a past breakdown with no clocks, `import` for a live ticket with its history. */
  channel: 'import' | 'backfill';
  machine: {
    id: string;
    snapshot: Record<string, unknown>;
    criticality: 'A' | 'B' | 'C' | null;
  } | null;
  location: string | null;
  workType: string | null;
  urgent: boolean;
  /** The login that recorded it, when a person did (a past breakdown); an import leaves it empty. */
  raisedLoginId?: string | null;
  /** Minutes entered by hand, in the figures' own override keys; they mark those figures as set by hand. */
  overrides?: Record<string, number>;
  problem: string;
  reportedAt: When;
  reportedByPersonId: string | null;
  reportedByRole: string | null;
  state: {
    selfStarted: boolean;
    startedAt: When;
    leadPersonId: string | null;
    segmentStartedAt: When;
    handedOver: boolean;
    handoverSince: When;
    transferToPersonId: string | null;
    transfers: number;
    waitReason: string | null;
    waitSince: When;
    pausedByPersonId: string | null;
    assignedToPersonId: string | null;
    expectedBackAt: When;
    waitingSpare: string | null;
    machineRunningAt: When;
    machineStoppedAt: When;
    closedAt: When;
    closedByPersonId: string | null;
    closeKind: 'report' | 'no_report' | 'done' | null;
    closeNote: string | null;
    cancelledAt: When;
    taskReason: string | null;
    taskExpectedOn: string | null;
    taskDownMin: number | null;
    editedAt: When;
  };
  /** The nine cached figures, exactly as the source holds them. */
  figures: {
    responseMin: number | null;
    activeMin: number;
    waitMin: number;
    vendorMin: number;
    handoverWaitMin: number;
    downAccMin: number;
    downtimeMin: number | null;
    followMin: number | null;
    repairMin: number | null;
  };
  events: Array<{
    type: string;
    at: When;
    actingPersonId: string | null;
    text: string | null;
    payload: Record<string, unknown>;
    /** The login that entered the event, when a person did (a past breakdown); an import leaves it empty. */
    loginId?: string | null;
  }>;
  crew: Array<{
    personId: string;
    role: 'primary' | 'support';
    joinedAt: When;
    leftAt: When;
    leftReason: string | null;
  }>;
  segments: Array<{
    personId: string;
    role: 'lead' | 'primary' | 'support';
    startedAt: When;
    endedAt: When;
    endReason: 'pause' | 'transfer' | 'leave' | 'close' | 'cancel' | null;
  }>;
  report: {
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
    submittedByPersonId: string | null;
    submittedAt: When;
    doneByPersonIds: string[];
    supportedByPersonIds: string[];
  } | null;
}

type Columns = Record<string, unknown>;

function whoAndWhat(tenantId: string, row: ImportedTicketRow, severity: string | null): Columns {
  return {
    tenant_id: tenantId,
    ref: row.ref,
    kind: row.kind,
    status: row.status,
    machine_id: row.machine?.id ?? null,
    machine_snapshot: JSON.stringify(row.machine?.snapshot ?? {}),
    location: row.location,
    work_type: row.workType,
    urgent: row.urgent,
    problem: row.problem,
    reported_at: row.reportedAt,
    reported_by_person_id: row.reportedByPersonId,
    reported_by_role: row.reportedByRole,
    raised_login_id: row.raisedLoginId ?? null,
    raised_channel: row.channel,
    severity,
    criticality_snapshot: row.machine?.criticality ?? null,
    last_event_seq: row.events.length - 1,
    overrides: JSON.stringify(row.overrides ?? {}),
  };
}

function stateColumns(s: ImportedTicketRow['state']): Columns {
  return {
    self_started: s.selfStarted,
    started_at: s.startedAt,
    lead_person_id: s.leadPersonId,
    segment_started_at: s.segmentStartedAt,
    handed_over: s.handedOver,
    handover_since: s.handoverSince,
    transfer_to_person_id: s.transferToPersonId,
    transfers: s.transfers,
    wait_reason: s.waitReason,
    wait_since: s.waitSince,
    paused_by_person_id: s.pausedByPersonId,
    assigned_to_person_id: s.assignedToPersonId,
    expected_back_at: s.expectedBackAt,
    waiting_spare: s.waitingSpare,
    machine_running_at: s.machineRunningAt,
    machine_stopped_at: s.machineStoppedAt,
    closed_at: s.closedAt,
    closed_by_person_id: s.closedByPersonId,
    close_kind: s.closeKind,
    close_note: s.closeNote,
    cancelled_at: s.cancelledAt,
    edited_at: s.editedAt,
    task_reason: s.taskReason,
    task_expected_on: s.taskExpectedOn,
    task_down_min: s.taskDownMin,
  };
}

function figureColumns(f: ImportedTicketRow['figures']): Columns {
  return {
    response_min: f.responseMin,
    active_min: f.activeMin,
    wait_min: f.waitMin,
    vendor_min: f.vendorMin,
    handover_wait_min: f.handoverWaitMin,
    down_acc_min: f.downAccMin,
    downtime_min: f.downtimeMin,
    follow_min: f.followMin,
    repair_min: f.repairMin,
  };
}

async function insertReport(
  tx: PoolClient,
  tenantId: string,
  ticketId: string,
  row: ImportedTicketRow,
): Promise<void> {
  const r = row.report;
  if (!r || !row.machine) return;
  const reportId = await insertImportedReport(tx, [
    tenantId,
    ticketId,
    row.machine.id,
    r.date,
    r.shiftCode,
    r.problem,
    r.observedBy,
    r.correctiveAction,
    r.downtimeMin,
    r.responseMin,
    r.repairMin,
    r.breakdownCategory,
    r.maintCode,
    r.spareUsed,
    r.rootCause,
    r.handoverName,
    r.submittedByPersonId,
    r.submittedAt,
  ]);
  for (const personId of r.doneByPersonIds) {
    await insertReportPerson(tx, [tenantId, reportId, personId, 'done']);
  }
  for (const personId of r.supportedByPersonIds) {
    await insertReportPerson(tx, [tenantId, reportId, personId, 'supported']);
  }
}

async function insertChildren(
  tx: PoolClient,
  tenantId: string,
  ticketId: string,
  row: ImportedTicketRow,
): Promise<void> {
  for (const [seq, e] of row.events.entries()) {
    await insertImportedEvent(tx, [
      tenantId,
      ticketId,
      seq,
      e.type,
      e.at,
      e.actingPersonId,
      e.text,
      JSON.stringify(e.payload),
      e.loginId ?? null,
    ]);
  }
  for (const c of row.crew) {
    await insertImportedCrew(tx, [
      tenantId,
      ticketId,
      c.personId,
      c.role,
      c.joinedAt,
      c.leftAt,
      c.leftReason,
    ]);
  }
  for (const g of row.segments) {
    await insertImportedSegment(tx, [
      tenantId,
      ticketId,
      g.personId,
      g.role,
      g.startedAt,
      g.endedAt,
      g.endReason,
    ]);
  }
  await insertReport(tx, tenantId, ticketId, row);
}

/** The only writer of imported history: tickets, their events, crew, work segments and break-down report. */
export async function importTickets(
  tx: PoolClient,
  tenantId: string,
  rows: readonly ImportedTicketRow[],
): Promise<string[]> {
  const matrix = await loadSeverityMatrix(tx, tenantId);
  const ids: string[] = [];
  for (const row of rows) {
    const severity = computeSeverity(matrix, row.machine?.criticality ?? null, row.kind, false);
    const columns = {
      ...whoAndWhat(tenantId, row, severity),
      ...stateColumns(row.state),
      ...figureColumns(row.figures),
    };
    const id = await insertImportedTicket(tx, Object.keys(columns), Object.values(columns));
    await insertChildren(tx, tenantId, id, row);
    ids.push(id);
  }
  return ids;
}
