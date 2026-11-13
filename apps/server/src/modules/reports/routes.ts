import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type { Figures } from '@uptimo/domain';
import { canDayReport, type ActorContext } from '@uptimo/domain';
import { apiError } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { peopleByIds, requireAuth, tenantInfo } from '../identity/index.js';
import type { AppConfig } from '../../kernel/index.js';
import { withMachines } from './machines.js';
import { buildQrPayload, qrSvg, qrText, renderPdf } from './pdf.js';
import { RenderBusyError } from './render-gate.js';
import { renderReportHtml, type ReportPdfInput } from './pdf-template.js';
import { loadDayReport, type DayReportData } from './day-report.js';
import { renderDayReportHtml } from './day-report-template.js';
import { figuresFromRow, loadReport, pdfTicketRow, type StoredReport } from '../tickets/index.js';

const PDF_MIME = 'application/pdf';

interface PdfTicket {
  id: string;
  ref: string;
  kind: string;
  status: string;
  problem: string;
  reportedAt: Date;
  closedAt: Date | null;
  figures: Figures;
  machine: { code: string | null; category: string | null; cell: string | null };
}

interface PdfContext {
  tenant: { name: string; language: string; timeZone: string };
  ticket: PdfTicket;
  report: StoredReport | null;
  people: Record<string, string>;
}

interface PdfDeps {
  pool: Pool;
  chromiumPath?: string;
}

function machineOf(row: Record<string, unknown>): PdfTicket['machine'] {
  const snapshot = (row.machine_snapshot ?? {}) as Record<string, string | null>;
  return {
    code: (row.machine_code as string | null) ?? snapshot.code ?? null,
    category: (row.machine_category as string | null) ?? snapshot.category ?? null,
    cell: (row.machine_cell as string | null) ?? snapshot.cell ?? null,
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
  const ids = [...new Set(report.people.map((person) => person.personId))];
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

function pdfInput(context: PdfContext, svg: string): ReportPdfInput {
  return {
    tenant: context.tenant,
    ticket: context.ticket,
    report: context.report as StoredReport,
    people: { done: namesFor(context, 'done'), supported: namesFor(context, 'supported') },
    qr: { svg },
    generatedAt: new Date(),
  };
}

function payloadFor(context: PdfContext): ReturnType<typeof buildQrPayload> {
  const report = context.report as StoredReport;
  return buildQrPayload({
    machineId: report.machineId,
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

/** A PDF is made when asked for and sent as it is: nothing is stored, so nothing is lost on a deploy. */
function sendBytes(reply: FastifyReply, bytes: Buffer, fileName: string): void {
  reply.type(PDF_MIME).header('content-disposition', `inline; filename="${fileName}"`).send(bytes);
}

/** Runs a render; a full queue becomes a 503 the caller can retry (null: the reply is already sent). */
async function renderOrBusy(
  reply: FastifyReply,
  render: () => Promise<Buffer>,
): Promise<Buffer | null> {
  try {
    return await render();
  } catch (error) {
    if (!(error instanceof RenderBusyError)) throw error;
    reply
      .code(503)
      .header('retry-after', '5')
      .send(
        apiError('rate_limited', 'Too many reports are being made right now; try again shortly'),
      );
    return null;
  }
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
  if (!context.report) {
    reply.code(409).send(apiError('conflict', 'This ticket has no breakdown report'));
    return;
  }
  const bytes = await renderOrBusy(reply, () => renderTicketPdf(deps, context));
  if (bytes)
    sendBytes(reply, bytes, `Breakdown_${context.ticket.ref.replace(/[^a-z0-9-]+/gi, '_')}.pdf`);
}

function isCalendarDate(value: string): boolean {
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const dayReportQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isCalendarDate),
  personId: z.union([z.literal('me'), z.string().uuid()]).optional(),
  shift: z.enum(['day', 'night']).default('day'),
});

function dayReportFileName(data: DayReportData): string {
  const who = data.person.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'person';
  return `Day_report_${who}_${data.date}_${data.shift}.pdf`;
}

/** Role gate + own-only rule for the day report (DOMAIN §3). */
function resolveDayPerson(
  auth: { role: string; loginId: string; personId: string | null; shared: boolean },
  requested: string | undefined,
):
  | { ok: true; personId: string }
  | { ok: false; status: 403 | 422; message: string; field?: string } {
  const actor: ActorContext = {
    role: auth.role as ActorContext['role'],
    loginId: auth.loginId,
    personId: auth.personId,
    shared: auth.shared,
  };
  if (!canDayReport(actor)) {
    return { ok: false, status: 403, message: 'Day reports are unavailable for your role' };
  }
  const wantsOther = Boolean(requested && requested !== 'me' && requested !== auth.personId);
  if (auth.role === 'technician' && wantsOther) {
    return {
      ok: false,
      status: 403,
      message: 'You can only see your own day report',
      field: 'personId',
    };
  }
  const personId = !requested || requested === 'me' ? auth.personId : requested;
  if (!personId) {
    return { ok: false, status: 422, message: 'No acting person for "me"', field: 'personId' };
  }
  return { ok: true, personId };
}

/** `GET /reports/day.pdf` — the caller's (or a chosen person's) day, rendered to PDF. */
async function sendDayPdf(
  deps: PdfDeps,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const auth = await requireAuth(deps.pool, request, reply);
  if (!auth) return;
  const parsed = dayReportQuerySchema.safeParse(request.query ?? {});
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.');
    reply.code(422).send(apiError('validation', 'Invalid day report query', field || undefined));
    return;
  }
  const resolved = resolveDayPerson(auth, parsed.data.personId);
  if (!resolved.ok) {
    const code = resolved.status === 403 ? 'forbidden' : 'validation';
    reply.code(resolved.status).send(apiError(code, resolved.message, resolved.field));
    return;
  }
  const data = await withTenant(deps.pool, auth.tenantId, (client) =>
    loadDayReport(client, {
      tenantId: auth.tenantId,
      personId: resolved.personId,
      date: parsed.data.date,
      shift: parsed.data.shift,
    }),
  );
  if (!data) {
    reply.code(404).send(apiError('not_found', 'Unknown person', 'personId'));
    return;
  }
  const bytes = await renderOrBusy(reply, () =>
    renderPdf(renderDayReportHtml(data), deps.chromiumPath),
  );
  if (bytes) sendBytes(reply, bytes, dayReportFileName(data));
}

export function registerReports(app: FastifyInstance, config: AppConfig): void {
  const deps: PdfDeps = { pool: config.pool, chromiumPath: config.chromiumPath };
  app.get('/api/v1/tickets/:id/pdf', (request, reply) => sendPdf(deps, request, reply));
  app.get('/api/v1/reports/day.pdf', (request, reply) => sendDayPdf(deps, request, reply));
}
