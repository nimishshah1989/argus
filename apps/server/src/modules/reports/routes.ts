import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
import {
  createLocalFileStore,
  dayReportObjectKey,
  insertFileRow,
  pdfObjectKey,
  type ObjectStore,
} from '../files/index.js';
import { buildQrPayload, qrSvg, qrText, renderPdf } from './pdf.js';
import { renderReportHtml, type ReportPdfInput } from './pdf-template.js';
import { loadDayReport, type DayReportData } from './day-report.js';
import { renderDayReportHtml } from './day-report-template.js';
import { loadReport, type StoredReport } from '../../ticket-report.js';
import { figuresFromRow } from '../../ticket-mapper.js';

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
  store: ObjectStore;
  chromiumPath?: string;
}

const TICKET_SQL = `SELECT t.id, t.ref, t.kind, t.status, t.problem, t.reported_at, t.closed_at,
    t.machine_snapshot, t.response_min, t.active_min, t.wait_min, t.vendor_min,
    t.handover_wait_min, t.down_acc_min, t.downtime_min, t.follow_min, t.repair_min, t.machine_id
  FROM ticket t
  WHERE t.id = $1 AND t.tenant_id = $2`;

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
  const found = (await client.query(TICKET_SQL, [ticketId, tenantId])).rows;
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

async function renderTicketPdf(
  deps: PdfDeps,
  tenantId: string,
  context: PdfContext,
): Promise<{ fileId: string; url: string }> {
  const report = context.report as StoredReport;
  const payload = payloadFor(context);
  const text = qrText(payload);
  const html = renderReportHtml(pdfInput(context, await qrSvg(text)));
  const bytes = await renderPdf(html, deps.chromiumPath);
  const key = pdfObjectKey(tenantId, context.ticket.id);
  await deps.store.put(key, bytes);
  const fileId = await withTenant(deps.pool, tenantId, async (client) => {
    const id = await insertFileRow(client, {
      tenantId,
      ticketId: context.ticket.id,
      key,
      mime: PDF_MIME,
      bytes,
    });
    await client.query(
      'UPDATE breakdown_report SET pdf_file_id = $1, qr_payload = $2 WHERE id = $3 AND tenant_id = $4',
      [id, payload, report.id, tenantId],
    );
    return id;
  });
  return { fileId, url: `/api/v1/files/${fileId}` };
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
  reply.send(await renderTicketPdf(deps, auth.tenantId, context));
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
  const bytes = await renderPdf(renderDayReportHtml(data), deps.chromiumPath);
  const key = dayReportObjectKey(auth.tenantId, data.date, data.shift);
  await deps.store.put(key, bytes);
  const fileId = await withTenant(deps.pool, auth.tenantId, (client) =>
    insertFileRow(client, {
      tenantId: auth.tenantId,
      ticketId: null,
      key,
      mime: PDF_MIME,
      bytes,
    }),
  );
  reply
    .type(PDF_MIME)
    .header('content-disposition', `inline; filename="${dayReportFileName(data)}"`)
    .header('x-file-id', fileId)
    .send(bytes);
}

export function registerReports(app: FastifyInstance, config: AppConfig): void {
  const deps: PdfDeps = {
    pool: config.pool,
    store: createLocalFileStore(config.filesDir ?? join(tmpdir(), 'uptimo-files')),
    chromiumPath: config.chromiumPath,
  };
  app.get('/api/v1/tickets/:id/pdf', (request, reply) => sendPdf(deps, request, reply));
  app.get('/api/v1/reports/day.pdf', (request, reply) => sendDayPdf(deps, request, reply));
}
