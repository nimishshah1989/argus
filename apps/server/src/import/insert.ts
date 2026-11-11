import type { PoolClient } from 'pg';
import {
  orNull,
  resolveMachineCode,
  type BhavinReport,
  type BhavinTicket,
  type ImportCtx,
  type Machine,
  type TicketImport,
} from './schema.js';

async function findMachine(
  ctx: ImportCtx,
  code: string | null | undefined,
): Promise<Machine | null> {
  if (!code) return null;
  const resolved = resolveMachineCode(code);
  if (!resolved) return null;
  const row = (
    await ctx.client.query(
      'SELECT id, code, category, cell FROM machine WHERE tenant_id = $1 AND code = $2',
      [ctx.tenantId, resolved],
    )
  ).rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    snapshot: { code: row.code, category: row.category, cell: row.cell },
  };
}

async function resolvePerson(
  ctx: ImportCtx,
  name: string | null | undefined,
  people: Map<string, string>,
): Promise<string | null> {
  if (!name) return null;
  const hit = people.get(name);
  if (hit) return hit;
  const existing = (
    await ctx.client.query('SELECT id FROM person WHERE tenant_id = $1 AND name = $2 AND active', [
      ctx.tenantId,
      name,
    ])
  ).rows[0];
  const id = existing
    ? (existing.id as string)
    : (
        (
          await ctx.client.query(
            `INSERT INTO person (tenant_id, name, team, kind, active, pending)
             VALUES ($1, $2, 'production', 'production', true, true) RETURNING id`,
            [ctx.tenantId, name],
          )
        ).rows[0] as { id: string }
      ).id;
  people.set(name, id);
  return id;
}

async function insertTicketRow(
  ctx: ImportCtx,
  t: BhavinTicket,
  machine: Machine | null,
  people: Map<string, string>,
): Promise<string> {
  const reportedBy = await resolvePerson(ctx, t.reportedByPerson, people);
  const lead = await resolvePerson(ctx, t.leadPerson, people);
  const closedBy = t.closeKind && lead ? lead : null;
  const row = (
    await ctx.client.query(
      `INSERT INTO ticket (
         tenant_id, ref, kind, status, machine_id, machine_snapshot, location, work_type,
         problem, reported_at, reported_by_person_id, raised_channel, self_started, started_at,
         lead_person_id, closed_at, closed_by_person_id, close_kind, close_note, cancelled_at,
         last_event_seq
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'import',false,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING id`,
      [
        ctx.tenantId,
        t.ref,
        t.kind,
        t.status,
        orNull(machine?.id),
        JSON.stringify(machine?.snapshot ?? {}),
        orNull(t.location),
        orNull(t.workType),
        t.problem,
        t.reportedAt,
        reportedBy,
        orNull(t.startedAt),
        lead,
        orNull(t.closedAt),
        closedBy,
        orNull(t.closeKind),
        orNull(t.closeNote),
        orNull(t.cancelledAt),
        t.events.length,
      ],
    )
  ).rows[0] as { id: string };
  return row.id;
}

async function insertEvents(ctx: ImportCtx, imp: TicketImport): Promise<number> {
  let seq = 0;
  for (const event of imp.ticket.events) {
    seq += 1;
    const acting = await resolvePerson(ctx, event.by, imp.people);
    await ctx.client.query(
      `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at, acting_person_id, text, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        ctx.tenantId,
        imp.ticketId,
        seq,
        event.type,
        event.at,
        acting,
        orNull(event.text),
        JSON.stringify(event.payload ?? {}),
      ],
    );
  }
  return seq;
}

async function insertCrew(ctx: ImportCtx, imp: TicketImport): Promise<number> {
  for (const member of imp.ticket.crew) {
    const personId = await resolvePerson(ctx, member.person, imp.people);
    await ctx.client.query(
      `INSERT INTO crew_member (tenant_id, ticket_id, person_id, role, joined_at, left_at, left_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        ctx.tenantId,
        imp.ticketId,
        personId,
        member.role === 'lead' ? 'primary' : member.role,
        member.joinedAt,
        orNull(member.leftAt),
        orNull(member.leftReason),
      ],
    );
  }
  return imp.ticket.crew.length;
}

async function insertSegments(ctx: ImportCtx, imp: TicketImport): Promise<number> {
  for (const segment of imp.ticket.segments) {
    const personId = await resolvePerson(ctx, segment.person, imp.people);
    await ctx.client.query(
      `INSERT INTO work_segment (tenant_id, ticket_id, person_id, role, started_at, ended_at, end_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        ctx.tenantId,
        imp.ticketId,
        personId,
        segment.role,
        segment.startedAt,
        orNull(segment.endedAt),
        orNull(segment.endReason),
      ],
    );
  }
  return imp.ticket.segments.length;
}

async function insertReportPeople(
  ctx: ImportCtx,
  reportId: string,
  report: BhavinReport,
  people: Map<string, string>,
): Promise<void> {
  const entries: Array<[string, string]> = [
    ...(report.doneBy ?? []).map((name) => [name, 'done'] as [string, string]),
    ...(report.supportedBy ?? []).map((name) => [name, 'supported'] as [string, string]),
  ];
  for (const [name, role] of entries) {
    const personId = await resolvePerson(ctx, name, people);
    await ctx.client.query(
      'INSERT INTO breakdown_report_person (tenant_id, report_id, person_id, role) VALUES ($1,$2,$3,$4)',
      [ctx.tenantId, reportId, personId, role],
    );
  }
}

async function insertReport(
  ctx: ImportCtx,
  report: BhavinReport,
  imp: TicketImport,
): Promise<void> {
  if (!imp.machine) return;
  const date =
    report.date ?? (imp.ticket.closedAt ?? imp.ticket.reportedAt).toISOString().slice(0, 10);
  const submittedBy = await resolvePerson(ctx, report.observedBy, imp.people);
  const reportId = (
    (
      await ctx.client.query(
        `INSERT INTO breakdown_report (
           tenant_id, ticket_id, machine_id, date, shift_code, problem, observed_by,
           corrective_action, downtime_min, response_min, repair_min, breakdown_category,
           maint_code, spare_used, root_cause, handover_name, submitted_by_person_id, submitted_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now())
         RETURNING id`,
        [
          ctx.tenantId,
          imp.ticketId,
          imp.machine.id,
          date,
          report.shiftCode ?? 'A',
          report.problem,
          orNull(report.observedBy),
          orNull(report.correctiveAction),
          report.downtimeMin ?? 0,
          orNull(report.responseMin),
          orNull(report.repairMin),
          orNull(report.breakdownCategory),
          orNull(report.maintCode),
          orNull(report.spareUsed),
          orNull(report.rootCause),
          orNull(report.handoverName),
          submittedBy,
        ],
      )
    ).rows[0] as { id: string }
  ).id;
  await insertReportPeople(ctx, reportId, report, imp.people);
}

async function insertReports(ctx: ImportCtx, imp: TicketImport): Promise<void> {
  for (const report of imp.ticket.reports) {
    await insertReport(ctx, report, imp);
  }
}

export async function importTicket(
  client: PoolClient,
  tenantId: string,
  ticket: BhavinTicket,
): Promise<{ ticketId: string; events: number; crew: number; segments: number }> {
  const ctx: ImportCtx = { client, tenantId };
  const people = new Map<string, string>();
  const machine = await findMachine(ctx, ticket.machineCode);
  const ticketId = await insertTicketRow(ctx, ticket, machine, people);
  const imp: TicketImport = { ticketId, ticket, machine, people };
  const events = await insertEvents(ctx, imp);
  const crew = await insertCrew(ctx, imp);
  const segments = await insertSegments(ctx, imp);
  await insertReports(ctx, imp);
  return { ticketId, events, crew, segments };
}
