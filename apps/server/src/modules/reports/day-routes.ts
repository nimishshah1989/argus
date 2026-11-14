import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { canDayReport, canTeamDayReport, type ActorContext } from '@uptimo/domain';
import { apiError } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { requireAuth } from '../identity/index.js';
import { renderPdf } from './pdf.js';
import { renderOrBusy, sendBytes, type PdfDeps } from './pdf-send.js';
import { loadDayReport, type DayReportData } from './day-report.js';
import { renderDayReportHtml } from './day-report-template.js';
import { loadTeamDayReport } from './team-report.js';
import { renderTeamDayReportHtml } from './team-day-report-template.js';

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
  /** `team=1`, as in v3: the whole team's day instead of one person's. */
  team: z.literal('1').optional(),
  personId: z.union([z.literal('me'), z.string().uuid()]).optional(),
  /** One of the plant's shift codes; left out, the whole calendar day. */
  shift: z.string().trim().min(1).max(20).optional(),
});

function dayReportFileName(data: DayReportData): string {
  const who = data.person.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'person';
  const shift = data.shift ? `_shift${data.shift}`.replace(/[^A-Za-z0-9_-]+/g, '') : '';
  return `Day_report_${who}_${data.date}${shift}.pdf`;
}

type DayAsk =
  | { ok: true; team: true }
  | { ok: true; team: false; personId: string }
  | { ok: false; status: 403 | 422; message: string; field?: string };

const refuse = (message: string, field?: string): DayAsk => ({
  ok: false,
  status: 403,
  message,
  ...(field ? { field } : {}),
});

/** Role gate + own-only rule + team rule for the day report (DOMAIN §3). */
function resolveDayAsk(
  auth: { role: string; loginId: string; personId: string | null; shared: boolean },
  query: { team?: '1'; personId?: string },
): DayAsk {
  const actor: ActorContext = {
    role: auth.role as ActorContext['role'],
    loginId: auth.loginId,
    personId: auth.personId,
    shared: auth.shared,
  };
  if (!canDayReport(actor)) return refuse('Day reports are unavailable for your role');
  const requested = query.personId;
  const wantsOther = Boolean(requested && requested !== 'me' && requested !== auth.personId);
  if (auth.role === 'plant_head') {
    // The plant head's view is the team (DOMAIN §3): it is the default, and one person's day is not theirs to ask for.
    return wantsOther
      ? refuse('The plant head sees the team day report', 'personId')
      : { ok: true, team: true };
  }
  if (query.team) {
    return canTeamDayReport(actor)
      ? { ok: true, team: true }
      : refuse('You can only see your own day report', 'team');
  }
  return resolvePerson(auth, requested, wantsOther);
}

/** One person's day: a technician only their own; anyone else allowed a day report may pick a person. */
function resolvePerson(
  auth: { role: string; personId: string | null },
  requested: string | undefined,
  wantsOther: boolean,
): DayAsk {
  if (auth.role === 'technician' && wantsOther) {
    return refuse('You can only see your own day report', 'personId');
  }
  const personId = !requested || requested === 'me' ? auth.personId : requested;
  if (!personId) {
    return { ok: false, status: 422, message: 'No acting person for "me"', field: 'personId' };
  }
  return { ok: true, team: false, personId };
}

interface DayQuery {
  date: string;
  shift?: string;
}

const NO_SHIFT = 'This plant has no such shift';

function teamFileName(date: string, shift: string | undefined): string {
  const suffix = shift ? `_shift${shift}`.replace(/[^A-Za-z0-9_-]+/g, '') : '';
  return `Day_report_Team_${date}${suffix}.pdf`;
}

async function sendTeamPdf(
  deps: PdfDeps,
  auth: { tenantId: string },
  query: DayQuery,
  reply: FastifyReply,
): Promise<void> {
  const data = await withTenant(deps.pool, auth.tenantId, (client) =>
    loadTeamDayReport(client, {
      tenantId: auth.tenantId,
      date: query.date,
      shift: query.shift ?? null,
    }),
  );
  if (data === 'no-shift' || !data) {
    reply.code(422).send(apiError('validation', NO_SHIFT, 'shift'));
    return;
  }
  const bytes = await renderOrBusy(reply, () =>
    renderPdf(renderTeamDayReportHtml(data), deps.chromiumPath),
  );
  if (bytes) sendBytes(reply, bytes, teamFileName(query.date, query.shift));
}

async function sendPersonPdf(
  deps: PdfDeps,
  auth: { tenantId: string },
  query: DayQuery & { personId: string },
  reply: FastifyReply,
): Promise<void> {
  const data = await withTenant(deps.pool, auth.tenantId, (client) =>
    loadDayReport(client, {
      tenantId: auth.tenantId,
      personId: query.personId,
      date: query.date,
      shift: query.shift ?? null,
    }),
  );
  if (data === 'no-shift') {
    reply.code(422).send(apiError('validation', NO_SHIFT, 'shift'));
    return;
  }
  if (!data) {
    reply.code(404).send(apiError('not_found', 'Unknown person', 'personId'));
    return;
  }
  const bytes = await renderOrBusy(reply, () =>
    renderPdf(renderDayReportHtml(data), deps.chromiumPath),
  );
  if (bytes) sendBytes(reply, bytes, dayReportFileName(data));
}

/** `GET /reports/day.pdf`: a person's day (the caller's by default), or the team's with `team=1`. */
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
  const ask = resolveDayAsk(auth, parsed.data);
  if (!ask.ok) {
    const code = ask.status === 403 ? 'forbidden' : 'validation';
    reply.code(ask.status).send(apiError(code, ask.message, ask.field));
    return;
  }
  if (ask.team) return sendTeamPdf(deps, auth, parsed.data, reply);
  return sendPersonPdf(deps, auth, { ...parsed.data, personId: ask.personId }, reply);
}

export function registerDayReports(app: FastifyInstance, deps: PdfDeps): void {
  app.get('/api/v1/reports/day.pdf', (request, reply) => sendDayPdf(deps, request, reply));
}
