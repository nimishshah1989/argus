import { canonicalSha256 } from './json.js';
import type { CompletionFingerprint, EntryType } from './schema.js';

export const TICKET_FINGERPRINT_COLUMNS = [
  'id',
  'ref',
  'kind',
  'status',
  'machine_id',
  'machine_snapshot',
  'location',
  'work_type',
  'urgent',
  'problem',
  'problem_lang',
  'reported_at',
  'reported_by_person_id',
  'reported_by_role',
  'raised_login_id',
  'raised_channel',
  'self_started',
  'started_at',
  'lead_person_id',
  'segment_started_at',
  'handed_over',
  'handover_since',
  'transfer_to_person_id',
  'transfer_to_shift',
  'transfers',
  'wait_reason',
  'wait_since',
  'paused_by_person_id',
  'assigned_to_person_id',
  'expected_back_at',
  'waiting_spare',
  'machine_running_at',
  'machine_stopped_at',
  'closed_at',
  'closed_by_person_id',
  'close_kind',
  'close_note',
  'cancelled_at',
  'parent_id',
  'task_reason',
  'task_expected_on',
  'task_down_min',
  'kind_upgraded_at',
  'last_event_seq',
  'response_min',
  'active_min',
  'wait_min',
  'vendor_min',
  'handover_wait_min',
  'down_acc_min',
  'downtime_min',
  'follow_min',
  'repair_min',
  'overrides',
  'edited_at',
] as const;
export type TicketFingerprintColumn = (typeof TICKET_FINGERPRINT_COLUMNS)[number];

export interface BatchTicketSnapshot {
  rowNumber: number;
  legacyId: string;
  entryType: EntryType;
  ticketId: string;
  ticket: Record<TicketFingerprintColumn, unknown>;
  events: Array<{
    seq: number;
    type: string;
    idempotencyKey: string | null;
    at: string;
    loginId: string | null;
    actingPersonId: string | null;
    text: string | null;
    payload: Record<string, unknown>;
  }>;
  crew: Array<{
    id: string;
    personId: string;
    role: 'primary' | 'support';
    joinedAt: string;
    leftAt: string | null;
    leftReason: string | null;
  }>;
  segments: Array<{
    id: string;
    personId: string;
    role: 'lead' | 'primary' | 'support';
    startedAt: string;
    endedAt: string | null;
    endReason: 'pause' | 'transfer' | 'leave' | 'close' | 'cancel' | null;
  }>;
  reports: Array<{
    id: string;
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
    signatureFileId: string | null;
    pdfFileId: string | null;
    qrPayload: Record<string, unknown>;
    submittedByPersonId: string | null;
    submittedAt: string;
    approvedAt: string | null;
    people: Array<{ personId: string; role: 'done' | 'supported' }>;
  }>;
}

export interface BatchSnapshot {
  tickets: BatchTicketSnapshot[];
}

type TicketEntry = CompletionFingerprint['tickets'][number];

function byId<T extends { id: string }>(left: T, right: T): number {
  return left.id.localeCompare(right.id);
}

function canonicalTicket(ticket: BatchTicketSnapshot): BatchTicketSnapshot {
  return {
    ...ticket,
    events: [...ticket.events].sort((left, right) => left.seq - right.seq),
    crew: [...ticket.crew].sort(byId),
    segments: [...ticket.segments].sort(byId),
    reports: ticket.reports
      .map((report) => ({
        ...report,
        people: [...report.people].sort(
          (left, right) =>
            left.personId.localeCompare(right.personId) || left.role.localeCompare(right.role),
        ),
      }))
      .sort(byId),
  };
}

export function makeCompletionFingerprint(snapshot: BatchSnapshot): CompletionFingerprint {
  const tickets = snapshot.tickets
    .map((ticket) => canonicalTicket(ticket))
    .sort((left, right) => left.ticketId.localeCompare(right.ticketId))
    .map((ticket) => ({
      ticketId: ticket.ticketId,
      legacyId: ticket.legacyId,
      entryType: ticket.entryType,
      digest: canonicalSha256(ticket),
    }));
  return {
    version: 1,
    algorithm: 'sha256',
    digest: canonicalSha256({ version: 1, tickets }),
    tickets,
  };
}

export function emptyCompletionFingerprint(): CompletionFingerprint {
  return makeCompletionFingerprint({ tickets: [] });
}

function entryMismatches(expected: TicketEntry, actual: TicketEntry): string[] {
  const mismatches: string[] = [];
  if (expected.legacyId !== actual.legacyId || expected.entryType !== actual.entryType) {
    mismatches.push(
      `ticket ${expected.ticketId} provenance mismatch: expected ${expected.legacyId}/${expected.entryType}, actual ${actual.legacyId}/${actual.entryType}`,
    );
  }
  if (expected.digest !== actual.digest) {
    mismatches.push(
      `ticket ${expected.ticketId} (${expected.legacyId}) digest mismatch: expected ${expected.digest}, actual ${actual.digest}`,
    );
  }
  return mismatches;
}

export function fingerprintMismatches(
  expected: CompletionFingerprint,
  actual: CompletionFingerprint,
): string[] {
  const mismatches: string[] = [];
  if (expected.version !== 1 || expected.algorithm !== 'sha256') {
    mismatches.push('expected fingerprint version or algorithm is invalid');
  }
  if (expected.digest !== actual.digest) {
    mismatches.push(
      `overall digest mismatch: expected ${expected.digest}, actual ${actual.digest}`,
    );
  }
  const actualById = new Map(actual.tickets.map((ticket) => [ticket.ticketId, ticket]));
  for (const ticket of expected.tickets) {
    const current = actualById.get(ticket.ticketId);
    if (!current) {
      mismatches.push(`ticket ${ticket.ticketId} (${ticket.legacyId}) is missing`);
    } else {
      mismatches.push(...entryMismatches(ticket, current));
    }
  }
  const expectedIds = new Set(expected.tickets.map((ticket) => ticket.ticketId));
  for (const ticket of actual.tickets) {
    if (!expectedIds.has(ticket.ticketId)) {
      mismatches.push(`ticket ${ticket.ticketId} (${ticket.legacyId}) is unexpected`);
    }
  }
  return mismatches;
}
