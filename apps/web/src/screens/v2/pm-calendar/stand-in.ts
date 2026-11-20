import { pmWithinWindow, type PmCalendarReply, type PmRescheduleReply } from '@uptimo/shared';
import { pmCalendar } from '@uptimo/domain';
import { ApiError } from '../../../data/index.js';
import plans from './plans.json' with { type: 'json' };
import type { SendMove } from './move.js';

/**
 * The gallery's PM calendar, until a screen reads the live routes. It is not made up: the plans are the 11 November
 * workbook's PM Plan reduced to one plan per machine by the seed's own mapper (`mapPmPlans`; a test holds this file
 * equal to it), and the calendar is the engine's own `pmCalendar` run over them, so crowding, the nearest free day and
 * every tolerance are the engine's. Only the write is a stand-in: it keeps a moved job in memory and mirrors four of
 * the server's refusals so the refusal state can be seen; the real server decides every date.
 */

/** The workbook export's day, the plant's today for this stand-in. */
export const TODAY = '2026-11-11';
const ZONE = 'Asia/Kolkata';

/** The compliance figure for 1 Jan to 11 Nov: the engine's own hand-worked fixture (50b); the workbook has no PM work orders. */
export const COMPLIANCE = {
  from: '2026-01-01',
  to: TODAY,
  pm: { eligible: 8, onTime: 2, early: 1, late: 2, overdue: 2, cancelled: 1, pending: 1, pct: 25 },
  schedule: { eligible: 11, done: 3, missed: 8, pending: 0, pct: 27.3 },
};

/** A stable UUID for a name: the real routes carry UUIDs, and the screen never prints one. */
export function uuidOf(name: string): string {
  let h = 0x811c9dc5;
  const hex: string[] = [];
  for (let i = 0; i < 32; i += 1) {
    h = Math.imul(h ^ (name.charCodeAt(i % name.length) + i), 0x01000193) >>> 0;
    hex.push((h >>> 28).toString(16));
  }
  hex[12] = '4';
  hex[16] = '8';
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

type Planned = {
  planId: string;
  machineId: string;
  machineCode: string;
  title: string;
  createdAt: string;
  lastDoneOn: string | null;
  intervalDays: number;
};

const PLANS: Planned[] = (plans as [string, number, string | null, string][]).map(
  ([code, intervalDays, lastDoneOn, anchorOn]) => ({
    planId: uuidOf(`plan:${code}`),
    machineId: uuidOf(`machine:${code}`),
    machineCode: code,
    title: `${code} preventive maintenance`,
    createdAt: `${anchorOn}T00:00:00+05:30`,
    lastDoneOn,
    intervalDays,
  }),
);

type Moved = { ticketId: string; machineId: string; scheduledOn: string };
const moved = new Map<string, Moved>();

/** The calendar reply for a stretch of days, as `GET /pm/calendar` answers it. */
export function calendarFor(range: { from: string; to: string }): PmCalendarReply {
  const tickets = PLANS.flatMap((plan) => {
    const job = moved.get(plan.machineId);
    return job
      ? [
          {
            ticketId: job.ticketId,
            machineId: plan.machineId,
            machineCode: plan.machineCode,
            title: `PM due: ${plan.title}`,
            scheduledOn: job.scheduledOn,
            started: false,
          },
        ]
      : [];
  });
  const calendar = pmCalendar(PLANS, tickets, { ...range, today: TODAY, timeZone: ZONE });
  return { ...range, today: TODAY, cap: calendar.cap, items: calendar.items };
}

const refuse = (status: number, message: string): never => {
  throw new ApiError(status === 409 ? 'conflict' : 'validation', message, 'scheduledOn', status);
};

/** The gallery's write: lands a move in memory, or refuses it in the server's words. */
export const standInSend: SendMove = async (body) => {
  const wide = calendarFor({ from: '2026-01-01', to: '2027-12-31' });
  const item = wide.items.find((i) => i.machineId === body.machineId);
  if (!item) throw new ApiError('not_found', 'Unknown machine', 'machineId', 404);
  const to = body.scheduledOn;
  if (to < TODAY) refuse(422, 'A PM job cannot be scheduled in the past');
  if (new Date(`${to}T00:00:00Z`).getUTCDay() === 0)
    refuse(422, 'PM jobs are scheduled Monday to Saturday');
  if (!pmWithinWindow(to, item.dueOn, item.toleranceDays))
    refuse(422, 'That date is outside the plan tolerance');
  if (wide.items.some((i) => i.machineId !== body.machineId && i.scheduledOn === to))
    refuse(409, 'That day already has a PM job');
  const ticketId = item.ticketId ?? uuidOf(`ticket:${body.machineId}`);
  moved.set(body.machineId, { ticketId, machineId: body.machineId, scheduledOn: to });
  const reply: PmRescheduleReply = {
    ticketId,
    ref: `PM-${moved.size}`,
    scheduledOn: to,
    created: item.ticketId === null,
  };
  return reply;
};
