import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { Figures } from '@uptimo/domain';
import { canBreakdownPdf, type ActorContext } from '@uptimo/domain';
import { apiError } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { loginAdminById, peopleByIds, requireAuth, tenantInfo } from '../identity/index.js';
import type { AppConfig } from '../../kernel/index.js';
import { withMachines } from './machines.js';
import { buildQrPayload, qrSvg, qrText, renderPdf } from './pdf.js';
import { renderReportHtml, type ReportPdfInput } from './pdf-template.js';
import { registerDayReports } from './day-routes.js';
import { renderOrBusy, sendBytes, type PdfDeps } from './pdf-send.js';
import { figuresFromRow, loadReport, pdfTicketRow, type StoredReport } from '../tickets/index.js';

interface PdfTicket {
  id: string;
  ref: string;
  kind: string;
  status: string;
  problem: string;
  reportedAt: Date;
  closedAt: Date | null;
  raisedLoginId: string | null;
  figures: Figures;
  machine: {
    code: string | null;
    /** The code when the ticket was raised: what v3 stored in the QR. */
    codeAtReport: string | null;
    category: string | null;
    cell: string | null;
    /** The cell when the ticket was raised: the one a shared floor login is allowed. */
    cellAtReport: string | null;
  };
}

interface PdfContext {
  tenant: { name: string; language: string; timeZone: string };
  ticket: PdfTicket;
  report: StoredReport | null;
  people: Record<string, string>;
}

function machineOf(row: Record<string, unknown>): PdfTicket['machine'] {
  const snapshot = (row.machine_snapshot ?? {}) as Record<string, string | null>;
  return {
    code: (row.machine_code as string | null) ?? snapshot.code ?? null,
    codeAtReport: snapshot.code ?? null,
    category: (row.machine_category as string | null) ?? snapshot.category ?? null,
    cell: (row.machine_cell as string | null) ?? snapshot.cell ?? null,
    cellAtReport: snapshot.cell ?? (row.machine_cell as string | null) ?? null,
  };
}

function ticketOf(row: Record<string, unknown>): PdfTicket {
  return {
    id: row.id as string,
    ref: row.ref as string,
    kind: row.kind as string,
    status: row.status as string,
    problem: row.problem as string,
    reportedAt: new Date(row.reported_at as string),
    closedAt: row.closed_at ? new Date(row.closed_at as string) : null,
    raisedLoginId: (row.raised_login_id as string | null) ?? null,
    figures: figuresFromRow(row),
    machine: machineOf(row),
  };
}

async function personNames(
  client: PoolClient,
  tenantId: string,
  report: StoredReport | null,
): Promise<Record<string, string>> {
  if (!report) return {};
  const ids = [
    ...new Set([
      ...report.people.map((person) => person.personId),
      ...(report.handoverPersonId ? [report.handoverPersonId] : []),
    ]),
  ];
  if (ids.length === 0) return {};
  const rows = await peopleByIds(client, tenantId, ids);
  return Object.fromEntries(rows.map((row) => [row.id as string, row.name as string]));
}

async function loadPdfContext(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
): Promise<PdfContext | null> {
  const found = await pdfTicketRow(client, tenantId, ticketId);
  if (found.length === 0) return null;
  const row = (await withMachines(client, tenantId, found))[0];
  const tenant = await tenantInfo(client, tenantId);
  const report = await loadReport(client, ticketId);
  return {
    tenant: {
      name: tenant.name as string,
      language: tenant.language as string,
      timeZone: tenant.time_zone as string,
    },
    ticket: ticketOf(row as Record<string, unknown>),
    report,
    people: await personNames(client, tenantId, report),
  };
}

function namesFor(context: PdfContext, role: 'done' | 'supported'): string[] {
  const report = context.report as StoredReport;
  return report.people
    .filter((person) => person.role === role)
    .map((person) => context.people[person.personId] ?? person.personId);
}

/** The person a report is handed over to, by name; null when none is linked (the typed text of imports is used then). */
function handoverName(context: PdfContext): string | null {
  const id = (context.report as StoredReport).handoverPersonId;
  return id ? (context.people[id] ?? null) : null;
}

function pdfInput(context: PdfContext, svg: string): ReportPdfInput {
  return {
    tenant: context.tenant,
    ticket: context.ticket,
    report: context.report as StoredReport,
    people: { done: namesFor(context, 'done'), supported: namesFor(context, 'supported') },
    handoverTo: handoverName(context),
    qr: { svg },
    generatedAt: new Date(),
  };
}

function payloadFor(context: PdfContext): ReturnType<typeof buildQrPayload> {
  const report = context.report as StoredReport;
  return buildQrPayload({
    // v3's QR names the machine by its code (`TC-7`), as it was when the report was made; ours is a uuid.
    machineId: context.ticket.machine.codeAtReport ?? context.ticket.machine.code ?? '',
    date: report.date,
    shiftCode: report.shiftCode,
    problem: report.problem,
    observedBy: report.observedBy,
    correctiveAction: report.correctiveAction,
    doneBy: namesFor(context, 'done').join(', '),
    supportedBy: namesFor(context, 'supported').join(', '),
    downtimeMin: report.downtimeMin,
    maintCode: report.maintCode,
    breakdownCategory: report.breakdownCategory,
    spareUsed: report.spareUsed,
    kind: context.ticket.kind,
    ref: context.ticket.ref,
    responseMin: report.responseMin,
    repairMin: report.repairMin,
  });
}

async function renderTicketPdf(deps: PdfDeps, context: PdfContext): Promise<Buffer> {
  const text = qrText(payloadFor(context));
  const html = renderReportHtml(pdfInput(context, await qrSvg(text)));
  return renderPdf(html, deps.chromiumPath);
}

/** `Breakdown_<machine>_<date>.pdf`, the name the old platform used (parity v3.reports.02). */
function ticketPdfName(context: PdfContext): string {
  const machine = context.ticket.machine.code ?? context.ticket.ref;
  const date = (context.report as StoredReport).date;
  return `Breakdown_${machine}_${date}.pdf`.replace(/[^A-Za-z0-9._-]+/g, '_');
}

/** DOMAIN §3: who may print a breakdown PDF; a shared floor login's cell comes from its login row. */
async function mayPrint(
  pool: Pool,
  auth: {
    tenantId: string;
    role: string;
    loginId: string;
    personId: string | null;
    shared: boolean;
  },
  ticket: PdfTicket,
): Promise<boolean> {
  const cell =
    auth.role === 'operator' && auth.shared
      ? ((await withTenant(pool, auth.tenantId, (client) => loginAdminById(client, auth.loginId)))
          ?.cell ?? null)
      : null;
  const actor = { ...auth, role: auth.role as ActorContext['role'], cell };
  return canBreakdownPdf(actor, {
    raisedLoginId: ticket.raisedLoginId,
    cell: ticket.machine.cellAtReport,
  });
}

async function sendPdf(deps: PdfDeps, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const auth = await requireAuth(deps.pool, request, reply);
  if (!auth) return;
  const ticketId = (request.params as { id: string }).id;
  const context = await withTenant(deps.pool, auth.tenantId, (client) =>
    loadPdfContext(client, auth.tenantId, ticketId),
  );
  if (!context) {
    reply.code(404).send(apiError('not_found', 'Unknown ticket'));
    return;
  }
  if (!(await mayPrint(deps.pool, auth, context.ticket))) {
    reply.code(403).send(apiError('forbidden', 'This breakdown report is not yours to print'));
    return;
  }
  if (!context.report) {
    reply.code(409).send(apiError('conflict', 'This ticket has no breakdown report'));
    return;
  }
  const bytes = await renderOrBusy(reply, () => renderTicketPdf(deps, context));
  if (bytes) sendBytes(reply, bytes, ticketPdfName(context));
}

export function registerReports(app: FastifyInstance, config: AppConfig): void {
  const deps: PdfDeps = { pool: config.pool, chromiumPath: config.chromiumPath };
  app.get('/api/v1/tickets/:id/pdf', (request, reply) => sendPdf(deps, request, reply));
  registerDayReports(app, deps);
}
