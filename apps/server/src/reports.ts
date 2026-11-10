import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { Figures } from '@uptimo/domain';
import { apiError } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { requireAuth } from './auth.js';
import type { AppConfig } from './config.js';
import {
  createLocalFileStore,
  insertFileRow,
  pdfObjectKey,
  type ObjectStore,
} from './file-store.js';
import { buildQrPayload, qrSvg, qrText, renderPdf } from './pdf.js';
import { renderReportHtml, type ReportPdfInput } from './pdf-template.js';
import { loadReport, type StoredReport } from './ticket-report.js';
import { figuresFromRow } from './ticket-mapper.js';

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
    t.handover_wait_min, t.down_acc_min, t.downtime_min, t.follow_min, t.repair_min,
    m.code AS machine_code, m.category AS machine_category, m.cell AS machine_cell
  FROM ticket t LEFT JOIN machine m ON m.id = t.machine_id AND m.tenant_id = t.tenant_id
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
  const rows = (
    await client.query(
      'SELECT id, name FROM person WHERE tenant_id = $1 AND id = ANY($2::uuid[])',
      [tenantId, ids],
    )
  ).rows;
  return Object.fromEntries(rows.map((row) => [row.id as string, row.name as string]));
}

async function loadPdfContext(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
): Promise<PdfContext | null> {
  const row = (await client.query(TICKET_SQL, [ticketId, tenantId])).rows[0];
  if (!row) return null;
  const tenant = (
    await client.query('SELECT name, language, time_zone FROM tenant_info($1)', [tenantId])
  ).rows[0];
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

export function registerReports(app: FastifyInstance, config: AppConfig): void {
  const deps: PdfDeps = {
    pool: config.pool,
    store: createLocalFileStore(config.filesDir ?? join(tmpdir(), 'uptimo-files')),
    chromiumPath: config.chromiumPath,
  };
  app.get('/api/v1/tickets/:id/pdf', (request, reply) => sendPdf(deps, request, reply));
}
