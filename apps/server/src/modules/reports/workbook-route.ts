import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { canAnalytics, workbookSheets } from '@uptimo/domain';
import { apiError, calendarDay } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { requireAuth, tenantInfo, tenantSlugFromHost } from '../identity/index.js';
import { actorOf, forbidden, plantToday } from '../plant/index.js';
import { loadEngineData, readProfile } from '../analytics/index.js';
import { pmReportsForExport } from '../tickets/index.js';
import { exportDataFor } from './export-data.js';
import { sendBytes, type PdfDeps } from './pdf-send.js';
import { writeXlsx } from './xlsx.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const DATE_PROBLEM = (): ReturnType<typeof apiError> =>
  apiError('validation', 'Use a date like 2026-11-14', 'asOf');

type Asked = { ok: true; asOf?: string } | { ok: false; problem: ReturnType<typeof apiError> };

/** `asOf` is optional; when given it must be a real plant date. */
function askedDate(query: unknown): Asked {
  const asOf = (query as { asOf?: unknown } | undefined)?.asOf;
  if (asOf === undefined) return { ok: true };
  if (typeof asOf === 'string' && calendarDay.safeParse(asOf).success) return { ok: true, asOf };
  return { ok: false, problem: DATE_PROBLEM() };
}

/** The tenant's slug for the file name: the host's first label, matching the sign-in check's own tenant. */
function slugFor(request: FastifyRequest, tenantName: string): string {
  const slug = tenantSlugFromHost(request.headers.host ?? '');
  return slug?.replace(/[^A-Za-z0-9-]+/g, '-') ?? tenantName.replace(/[^A-Za-z0-9]+/g, '-');
}

async function buildWorkbook(
  deps: PdfDeps,
  tenantId: string,
  asked: string | undefined,
): Promise<{ asOf: string; bytes: Buffer }> {
  return withTenant(deps.pool, tenantId, async (tx) => {
    const asOf = asked ?? (await plantToday(tx, tenantId));
    const data = await loadEngineData(tx, tenantId);
    const profile = await readProfile(tx, tenantId);
    const tenant = await tenantInfo(tx, tenantId);
    // The PM sheets are the plant's own plans and closed jobs (50 R15), never the platform's frozen key.
    const pmReports = await pmReportsForExport(tx, tenantId);
    const exportData = exportDataFor({ data, profile, tenant: tenant.name, asOf, pmReports });
    return { asOf, bytes: writeXlsx(workbookSheets(exportData)) };
  });
}

/**
 * `GET /api/v1/reports/workbook.xlsx`: the whole data set as the platform's 17 sheets, made when asked for and
 * sent as a download. Nothing is stored. `asOf` is optional and defaults to the plant's today.
 */
async function sendWorkbook(
  deps: PdfDeps,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ctx = await requireAuth(deps.pool, request, reply);
  if (!ctx) return;
  if (!canAnalytics(actorOf(ctx))) return forbidden(reply);
  const asked = askedDate(request.query);
  if (!asked.ok) {
    reply.code(422).send(asked.problem);
    return;
  }
  const tenant: { name: string } = await withTenant(deps.pool, ctx.tenantId, (tx) =>
    tenantInfo(tx, ctx.tenantId),
  );
  const built = await buildWorkbook(deps, ctx.tenantId, asked.asOf);
  sendBytes(reply, built.bytes, `${slugFor(request, tenant.name)}-workbook-${built.asOf}.xlsx`, {
    type: XLSX_MIME,
    disposition: 'attachment',
  });
}

export function registerWorkbookRoute(app: FastifyInstance, deps: PdfDeps): void {
  app.get('/api/v1/reports/workbook.xlsx', (request, reply) => sendWorkbook(deps, request, reply));
}
