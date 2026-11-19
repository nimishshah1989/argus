import type { PoolClient } from 'pg';
import { pmCalendar } from '@uptimo/domain';
import type { PmCalendarReply } from '@uptimo/shared';
import { tenantInfo } from '../identity/index.js';
import { machinesByIds, pmPlansForScheduling } from '../plant/index.js';
import { pmTicketsForCalendar } from './repo/pm.js';

/**
 * The calendar read (50a, R2): one effective plan per machine from the plant module, the open PM jobs that
 * replace them, and the machine codes they need. No plan is projected beyond its next due (49's 125 plans, not
 * the platform's 427 visits), and nothing is written.
 */
export async function pmCalendarFor(
  client: PoolClient,
  tenantId: string,
  range: { from: string; to: string },
  now: Date = new Date(),
): Promise<PmCalendarReply> {
  const { time_zone: timeZone } = await tenantInfo(client, tenantId);
  const today = now.toLocaleDateString('en-CA', { timeZone });
  const plans = await pmPlansForScheduling(client, tenantId);
  const tickets = await pmTicketsForCalendar(client, tenantId);
  const machineIds = [
    ...new Set([
      ...plans.map((plan) => plan.machineId),
      ...tickets.map((ticket) => ticket.machineId),
    ]),
  ];
  const machines = new Map(
    (await machinesByIds(client, tenantId, machineIds)).map((machine) => [machine.id, machine]),
  );
  const plantDay = (at: Date): string => at.toLocaleDateString('en-CA', { timeZone });

  const calendar = pmCalendar(
    plans.flatMap((plan) => {
      const machine = machines.get(plan.machineId);
      if (!machine || machine.status === 'scrapped') return [];
      return [
        {
          planId: plan.id,
          machineId: plan.machineId,
          machineCode: machine.code,
          title: plan.title,
          createdAt: plan.createdAt.toISOString(),
          lastDoneOn: plan.lastDoneOn,
          intervalDays: plan.intervalDays,
        },
      ];
    }),
    tickets.flatMap((ticket) => {
      const machine = machines.get(ticket.machineId);
      if (!machine || machine.status === 'scrapped') return [];
      return [
        {
          ticketId: ticket.ticketId,
          machineId: ticket.machineId,
          machineCode: machine.code,
          title: ticket.title,
          scheduledOn: ticket.scheduledOn ?? plantDay(ticket.reportedAt),
          started: ticket.status !== 'open' || ticket.startedAt !== null,
        },
      ];
    }),
    { ...range, today, timeZone },
  );
  return { from: range.from, to: range.to, today, cap: calendar.cap, items: calendar.items };
}
