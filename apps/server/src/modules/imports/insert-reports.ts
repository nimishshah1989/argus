import { insertImportedReport, insertReportPerson } from '../tickets/index.js';
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
    await insertReportPerson(ctx.client, [ctx.tenantId, reportId, entry.personId, entry.role]);
  }
  return entries.length;
}

async function insertReport(
  ctx: ImportCtx,
  ticketId: string,
  report: ReconciledReport,
): Promise<number> {
  const reportId = await insertImportedReport(ctx.client, [
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
  ]);
  return insertPeople(ctx, reportId, report);
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
