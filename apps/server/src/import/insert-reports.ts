import type { ImportCtx } from './batch.js';
import type { ReconciledReport } from './reconcile.js';

async function insertPeople(
  ctx: ImportCtx,
  reportId: string,
  report: ReconciledReport,
): Promise<number> {
  const entries = [
    ...report.doneByPersonIds.map((personId) => ({ personId, role: 'done' })),
    ...report.supportedByPersonIds.map((personId) => ({ personId, role: 'supported' })),
  ];
  for (const entry of entries) {
    await ctx.client.query(
      `INSERT INTO breakdown_report_person (tenant_id, report_id, person_id, role)
       VALUES ($1, $2, $3, $4)`,
      [ctx.tenantId, reportId, entry.personId, entry.role],
    );
  }
  return entries.length;
}

async function insertReport(
  ctx: ImportCtx,
  ticketId: string,
  report: ReconciledReport,
): Promise<number> {
  const result = await ctx.client.query(
    `INSERT INTO breakdown_report (
       tenant_id, ticket_id, machine_id, date, shift_code, problem, observed_by,
       corrective_action, downtime_min, response_min, repair_min, breakdown_category,
       maint_code, spare_used, root_cause, handover_name, submitted_by_person_id, submitted_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING id`,
    [
      ctx.tenantId,
      ticketId,
      report.machineId,
      report.date,
      report.shiftCode,
      report.problem,
      report.observedBy,
      report.correctiveAction,
      report.downtimeMin,
      report.responseMin,
      report.repairMin,
      report.breakdownCategory,
      report.maintCode,
      report.spareUsed,
      report.rootCause,
      report.handoverName,
      report.submittedByPersonId,
      report.submittedAt,
    ],
  );
  return insertPeople(ctx, result.rows[0].id as string, report);
}

export async function insertReports(
  ctx: ImportCtx,
  ticketId: string,
  reports: ReconciledReport[],
): Promise<{ reports: number; reportPeople: number }> {
  let reportPeople = 0;
  for (const report of reports) reportPeople += await insertReport(ctx, ticketId, report);
  return { reports: reports.length, reportPeople };
}
