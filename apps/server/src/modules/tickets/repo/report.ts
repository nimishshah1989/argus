import type { PoolClient } from 'pg';
import type { Figures, Ticket, TransitionResult } from '@uptimo/domain';
import type { BreakdownReportBody } from '@uptimo/shared';
import type { Tx } from '../mapper.js';
import { peopleByIds, tenantInfo } from '../../identity/index.js';
import { productionDateAt, shiftCodeAt } from '../../plant/index.js';

export interface StoredReportPerson {
  personId: string;
  role: 'done' | 'supported';
}

export interface StoredReport {
  id: string;
  ticketId: string | null;
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
  handoverPersonId: string | null;
  handoverName: string | null;
  submittedByPersonId: string | null;
  submittedAt: Date;
  people: StoredReportPerson[];
}

export interface ReportStoreInput {
  tenantId: string;
  ticket: Ticket;
  figures: Figures | null;
  actingPersonId: string | null;
  body: BreakdownReportBody;
}

interface ReportValues {
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
  handoverPersonId: string | null;
  handoverName: string | null;
}

const INSERT_REPORT_SQL = `INSERT INTO breakdown_report
  (tenant_id, ticket_id, machine_id, date, shift_code, problem, observed_by, corrective_action,
   downtime_min, response_min, repair_min, breakdown_category, maint_code, spare_used, root_cause,
   handover_name, handover_person_id, submitted_by_person_id)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
  RETURNING id, submitted_at`;

export class ReportValidationError extends Error {
  field: string;
  constructor(field: string) {
    super('Invalid report');
    this.field = field;
  }
}

function n(value: string | undefined): string | null {
  return value ?? null;
}

function figureDefaults(input: ReportStoreInput): {
  downtimeMin: number;
  responseMin: number | null;
  repairMin: number | null;
} {
  const b = input.body;
  const f = input.figures;
  const downtime = f ? f.downtimeMin : null;
  const response = f ? f.responseMin : null;
  const repair = f ? f.repairMin : null;
  return {
    downtimeMin: b.downtimeMin ?? downtime ?? 0,
    responseMin: b.responseMin ?? response,
    repairMin: b.repairMin ?? repair,
  };
}

/** The calendar date of `at` on the plant's wall clock. */
export async function plantDateAt(client: PoolClient, tenantId: string, at: Date): Promise<string> {
  const zone = (await tenantInfo(client, tenantId))?.time_zone ?? null;
  return productionDateAt(client, zone, at);
}

export async function shiftAt(client: PoolClient, tenantId: string, at: Date): Promise<string> {
  const zone = (await tenantInfo(client, tenantId))?.time_zone ?? null;
  return (await shiftCodeAt(client, zone, at)) ?? '1';
}

async function currentShift(client: PoolClient, tenantId: string): Promise<string> {
  return shiftAt(client, tenantId, new Date());
}

async function reportValues(client: PoolClient, input: ReportStoreInput): Promise<ReportValues> {
  const b = input.body;
  return {
    date: b.date ?? (await plantDateAt(client, input.tenantId, new Date())),
    shiftCode: b.shiftCode ?? (await currentShift(client, input.tenantId)),
    problem: b.problem ?? input.ticket.problem,
    observedBy: n(b.observedBy),
    correctiveAction: n(b.correctiveAction),
    breakdownCategory: n(b.breakdownCategory),
    maintCode: n(b.maintCode),
    spareUsed: n(b.spareUsed),
    rootCause: n(b.rootCause),
    // One truth: a person link replaces the typed text, which stays only for imported history.
    handoverPersonId: n(b.handoverPersonId),
    handoverName: b.handoverPersonId ? null : n(b.handoverName),
    ...figureDefaults(input),
  };
}

/** What replies call the handover: the linked person's name as the person row says it now, else the typed text. */
async function handoverDisplay(
  client: PoolClient,
  tenantId: string,
  values: { handoverPersonId: string | null; handoverName: string | null },
): Promise<string | null> {
  if (!values.handoverPersonId) return values.handoverName;
  const person = (await peopleByIds(client, tenantId, [values.handoverPersonId]))[0];
  return person?.name ?? null;
}

function handoverIds(body: BreakdownReportBody): string[] {
  return body.handoverPersonId ? [body.handoverPersonId] : [];
}

async function assertPeople(
  client: PoolClient,
  tenantId: string,
  ids: string[],
  field: string,
): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  if ((await peopleByIds(client, tenantId, unique)).length !== unique.length)
    throw new ReportValidationError(field);
}

async function insertPeople(
  client: PoolClient,
  tenantId: string,
  reportId: string,
  opts: { personIds: string[]; role: 'done' | 'supported' },
): Promise<void> {
  for (const personId of new Set(opts.personIds)) {
    await client.query(
      'INSERT INTO breakdown_report_person (tenant_id, report_id, person_id, role) VALUES ($1, $2, $3, $4)',
      [tenantId, reportId, personId, opts.role],
    );
  }
}

function peopleFor(done: string[], supported: string[]): StoredReportPerson[] {
  return [
    ...[...new Set(done)].map((personId) => ({ personId, role: 'done' as const })),
    ...[...new Set(supported)].map((personId) => ({ personId, role: 'supported' as const })),
  ];
}

/** A column that may be NULL, read as `null` rather than `undefined` when the row leaves it out. */
function maybe<T>(row: Record<string, unknown>, column: string): T | null {
  return (row[column] as T | null | undefined) ?? null;
}

function buildStoredReport(
  row: Record<string, unknown>,
  people: StoredReportPerson[],
): StoredReport {
  return {
    id: row.id as string,
    ticketId: maybe(row, 'ticket_id'),
    machineId: row.machine_id as string,
    date: row.date as string,
    shiftCode: row.shift_code as string,
    problem: row.problem as string,
    observedBy: maybe(row, 'observed_by'),
    correctiveAction: maybe(row, 'corrective_action'),
    downtimeMin: row.downtime_min as number,
    responseMin: maybe(row, 'response_min'),
    repairMin: maybe(row, 'repair_min'),
    breakdownCategory: maybe(row, 'breakdown_category'),
    maintCode: maybe(row, 'maint_code'),
    spareUsed: maybe(row, 'spare_used'),
    rootCause: maybe(row, 'root_cause'),
    handoverPersonId: maybe(row, 'handover_person_id'),
    handoverName: maybe(row, 'handover_name'),
    submittedByPersonId: maybe(row, 'submitted_by_person_id'),
    submittedAt: new Date(row.submitted_at as string | number | Date),
    people,
  };
}

/** Who the report names (done by, supported by, handed over to) must be people of this plant, and the handover is one or the other. */
async function checkReportPeople(
  client: PoolClient,
  input: ReportStoreInput,
): Promise<{ done: string[]; supported: string[] }> {
  const { body, tenantId } = input;
  const done =
    body.doneByPersonIds ?? (input.ticket.leadPersonId ? [input.ticket.leadPersonId] : []);
  const supported = body.supportedByPersonIds ?? [];
  await assertPeople(client, tenantId, done, 'doneByPersonIds');
  await assertPeople(client, tenantId, supported, 'supportedByPersonIds');
  if (body.handoverPersonId && body.handoverName) throw new ReportValidationError('handoverName');
  await assertPeople(client, tenantId, handoverIds(body), 'handoverPersonId');
  return { done, supported };
}

export async function storeBreakdownReport(
  client: PoolClient,
  input: ReportStoreInput,
): Promise<StoredReport> {
  const { done, supported } = await checkReportPeople(client, input);
  const values = await reportValues(client, input);
  const result = await client.query(INSERT_REPORT_SQL, [
    input.tenantId,
    input.ticket.id,
    input.ticket.machineId,
    values.date,
    values.shiftCode,
    values.problem,
    values.observedBy,
    values.correctiveAction,
    values.downtimeMin,
    values.responseMin,
    values.repairMin,
    values.breakdownCategory,
    values.maintCode,
    values.spareUsed,
    values.rootCause,
    values.handoverName,
    values.handoverPersonId,
    input.actingPersonId,
  ]);
  const reportId = result.rows[0].id as string;
  await insertPeople(client, input.tenantId, reportId, { personIds: done, role: 'done' });
  await insertPeople(client, input.tenantId, reportId, { personIds: supported, role: 'supported' });

  return buildStoredReport(
    {
      id: reportId,
      ticket_id: input.ticket.id,
      machine_id: input.ticket.machineId,
      date: values.date,
      shift_code: values.shiftCode,
      problem: values.problem,
      observed_by: values.observedBy,
      corrective_action: values.correctiveAction,
      downtime_min: values.downtimeMin,
      response_min: values.responseMin,
      repair_min: values.repairMin,
      breakdown_category: values.breakdownCategory,
      maint_code: values.maintCode,
      spare_used: values.spareUsed,
      root_cause: values.rootCause,
      handover_name: await handoverDisplay(client, input.tenantId, values),
      handover_person_id: values.handoverPersonId,
      submitted_by_person_id: input.actingPersonId,
      submitted_at: result.rows[0].submitted_at,
    },
    peopleFor(done, supported),
  );
}

export async function storeReportForTransition(
  client: PoolClient,
  tx: Tx,
  result: TransitionResult,
): Promise<void> {
  const shouldStore =
    tx.action === 'report' ||
    (tx.action === 'close' && tx.body.kind === 'report' && tx.body.report !== undefined);
  if (!shouldStore) return;
  await storeBreakdownReport(client, {
    tenantId: tx.tenantId,
    ticket: result.ticket,
    figures: result.ticket.figures,
    actingPersonId: tx.actingPersonId,
    body: tx.body.report as BreakdownReportBody,
  });
}

export async function loadReport(
  client: PoolClient,
  ticketId: string,
): Promise<StoredReport | null> {
  const row = (
    await client.query(
      `SELECT id, tenant_id, ticket_id, machine_id, date::text AS date, shift_code, problem, observed_by,
         corrective_action, downtime_min, response_min, repair_min, breakdown_category, maint_code,
         spare_used, root_cause, handover_name, handover_person_id, submitted_by_person_id, submitted_at
       FROM breakdown_report WHERE ticket_id = $1`,
      [ticketId],
    )
  ).rows[0];
  if (!row) return null;
  row.handover_name = await handoverDisplay(client, row.tenant_id as string, {
    handoverPersonId: (row.handover_person_id as string | null) ?? null,
    handoverName: (row.handover_name as string | null) ?? null,
  });
  const people = (
    await client.query('SELECT person_id, role FROM breakdown_report_person WHERE report_id = $1', [
      row.id,
    ])
  ).rows.map((p) => ({
    personId: p.person_id as string,
    role: p.role as 'done' | 'supported',
  }));
  return buildStoredReport(row as Record<string, unknown>, people);
}
