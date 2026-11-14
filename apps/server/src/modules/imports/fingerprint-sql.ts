import type { PoolClient } from 'pg';
import {
  TICKET_FINGERPRINT_COLUMNS,
  type BatchSnapshot,
  type BatchTicketSnapshot,
} from './fingerprint.js';
import { importedChildren, importedTicketRows } from '../tickets/index.js';
import { importedRowRows, isErasedPayload } from './repo.js';
import type { EntryType, StoredRawPayload } from './schema.js';

type Row = Record<string, unknown>;
type ChildGroups = ReturnType<typeof groupChildren>;

/** `entryType` is null when the row's raw envelope was erased with a person: the ticket's own channel says it then. */
type ImportedRow = {
  rowNumber: number;
  legacyId: string;
  entryType: EntryType | null;
  ticketId: string;
};

function timestamp(value: unknown): string {
  if (!(value instanceof Date)) throw new Error('Fingerprint timestamp is not a Date');
  return value.toISOString();
}

function nullableTimestamp(value: unknown): string | null {
  return value === null ? null : timestamp(value);
}

function ticketRecord(row: Row): BatchTicketSnapshot['ticket'] {
  const ticket = {} as BatchTicketSnapshot['ticket'];
  for (const column of TICKET_FINGERPRINT_COLUMNS) {
    if (!(column in row)) throw new Error(`Fingerprint column is missing: ${column}`);
    const value = row[column];
    ticket[column] = value instanceof Date ? value.toISOString() : value;
  }
  return ticket;
}

function readEntryType(payload: StoredRawPayload): EntryType {
  if (payload?.format !== 'argus.import-raw/v1') {
    throw new Error('Imported row has no versioned raw envelope');
  }
  const entryType = (payload.raw as { entryType?: unknown } | null)?.entryType;
  if (entryType !== 'ordinary' && entryType !== 'pastBreakdown') {
    throw new Error('Imported row has no valid entry type');
  }
  return entryType;
}

function entryTypeOfChannel(channel: unknown): EntryType {
  if (channel === 'backfill') return 'pastBreakdown';
  if (channel === 'import') return 'ordinary';
  throw new Error('Imported ticket was not raised by an import');
}

async function loadImportedRows(
  client: PoolClient,
  tenantId: string,
  batchId: string,
): Promise<ImportedRow[]> {
  const rows = await importedRowRows(client, tenantId, batchId);
  return rows.map((row) => {
    if (!row.ticket_id || !row.source_ref) throw new Error('Imported row provenance is dangling');
    return {
      rowNumber: row.row_number as number,
      legacyId: row.source_ref as string,
      entryType: isErasedPayload(row.payload)
        ? null
        : readEntryType(row.payload as StoredRawPayload),
      ticketId: row.ticket_id as string,
    };
  });
}

async function loadTicketRows(
  client: PoolClient,
  tenantId: string,
  ticketIds: string[],
  lockTickets: boolean,
): Promise<Map<string, Row>> {
  const columns = TICKET_FINGERPRINT_COLUMNS.map((column) =>
    column === 'task_expected_on' ? 'task_expected_on::text AS task_expected_on' : column,
  ).join(', ');
  const rows = await importedTicketRows(client, {
    tenantId,
    ticketIds,
    columns,
    lock: lockTickets,
  });
  return new Map(rows.map((row) => [row.id as string, row as Row]));
}

function groupRows(rows: Row[], key: string): Map<string, Row[]> {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const id = row[key] as string;
    const group = groups.get(id) ?? [];
    group.push(row);
    groups.set(id, group);
  }
  return groups;
}

function groupChildren(rows: Row[], reports: Row[], people: Row[]) {
  const kinds = ['seq', 'joined_at', 'started_at'];
  const groups = kinds.map(() => new Map<string, Row[]>());
  for (const row of rows) {
    const kind = 'seq' in row ? 0 : 'joined_at' in row ? 1 : 2;
    const id = row.ticket_id as string;
    const group = groups[kind]?.get(id) ?? [];
    group.push(row);
    groups[kind]?.set(id, group);
  }
  return {
    groups,
    reports: groupRows(reports, 'ticket_id'),
    people: groupRows(people, 'report_id'),
  };
}

function mapEvents(rows: Row[]): BatchTicketSnapshot['events'] {
  return rows.map((row) => ({
    seq: row.seq as number,
    type: row.type as string,
    idempotencyKey: row.idempotency_key as string | null,
    at: timestamp(row.at),
    loginId: row.login_id as string | null,
    actingPersonId: row.acting_person_id as string | null,
    text: row.text as string | null,
    payload: row.payload as Record<string, unknown>,
  }));
}

function mapCrew(rows: Row[]): BatchTicketSnapshot['crew'] {
  return rows.map((row) => ({
    id: row.id as string,
    personId: row.person_id as string,
    role: row.role as 'primary' | 'support',
    joinedAt: timestamp(row.joined_at),
    leftAt: nullableTimestamp(row.left_at),
    leftReason: row.left_reason as string | null,
  }));
}

function mapSegments(rows: Row[]): BatchTicketSnapshot['segments'] {
  return rows.map((row) => ({
    id: row.id as string,
    personId: row.person_id as string,
    role: row.role as 'lead' | 'primary' | 'support',
    startedAt: timestamp(row.started_at),
    endedAt: nullableTimestamp(row.ended_at),
    endReason: row.end_reason as BatchTicketSnapshot['segments'][number]['endReason'],
  }));
}

function mapReports(rows: Row[], people: Map<string, Row[]>): BatchTicketSnapshot['reports'] {
  return rows.map((row) => ({
    id: row.id as string,
    machineId: row.machine_id as string,
    date: row.date as string,
    shiftCode: row.shift_code as string,
    problem: row.problem as string,
    observedBy: row.observed_by as string | null,
    correctiveAction: row.corrective_action as string | null,
    downtimeMin: row.downtime_min as number,
    responseMin: row.response_min as number | null,
    repairMin: row.repair_min as number | null,
    breakdownCategory: row.breakdown_category as string | null,
    maintCode: row.maint_code as string | null,
    spareUsed: row.spare_used as string | null,
    rootCause: row.root_cause as string | null,
    handoverName: row.handover_name as string | null,
    signatureFileId: row.signature_file_id as string | null,
    pdfFileId: row.pdf_file_id as string | null,
    qrPayload: row.qr_payload as Record<string, unknown>,
    submittedByPersonId: row.submitted_by_person_id as string | null,
    submittedAt: timestamp(row.submitted_at),
    approvedAt: nullableTimestamp(row.approved_at),
    people: (people.get(row.id as string) ?? []).map((person) => ({
      personId: person.person_id as string,
      role: person.role as 'done' | 'supported',
    })),
  }));
}

function childrenFor(ticketId: string, children: ChildGroups) {
  const [events, crew, segments] = children.groups;
  return {
    events: mapEvents(events?.get(ticketId) ?? []),
    crew: mapCrew(crew?.get(ticketId) ?? []),
    segments: mapSegments(segments?.get(ticketId) ?? []),
    reports: mapReports(children.reports.get(ticketId) ?? [], children.people),
  };
}

export async function loadBatchSnapshot(
  client: PoolClient,
  tenantId: string,
  batchId: string,
  lockTickets: boolean,
): Promise<BatchSnapshot> {
  const imported = await loadImportedRows(client, tenantId, batchId);
  if (!imported.length) return { tickets: [] };
  const ticketIds = imported.map((row) => row.ticketId).sort();
  if (new Set(ticketIds).size !== ticketIds.length) {
    throw new Error('Imported ticket provenance is duplicated');
  }
  const ticketRows = await loadTicketRows(client, tenantId, ticketIds, lockTickets);
  const raw = await importedChildren(client, tenantId, ticketIds);
  const children = groupChildren(raw.rows, raw.reports, raw.people);
  return {
    tickets: imported.map((row) => {
      const ticket = ticketRows.get(row.ticketId);
      if (!ticket) throw new Error(`Imported ticket is missing: ${row.ticketId}`);
      const entryType = row.entryType ?? entryTypeOfChannel(ticket.raised_channel);
      return {
        ...row,
        entryType,
        ...childrenFor(row.ticketId, children),
        ticket: ticketRecord(ticket),
      };
    }),
  };
}
