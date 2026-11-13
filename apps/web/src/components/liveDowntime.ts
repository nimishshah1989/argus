import type { Ticket } from '../api.js';

/**
 * An open stopped ticket's downtime so far: the finished stopped stretches (the cached `down_acc`) plus
 * the stretch still open, none while the machine is running again (his `downNow`).
 */
export function downNow(ticket: Ticket, now: string): number {
  const open = ticket.machineRunningAt
    ? 0
    : Math.max(
        0,
        Math.floor(
          (Date.parse(now) - Date.parse(ticket.machineStoppedAt ?? ticket.reportedAt)) / 60000,
        ),
      );
  return (ticket.figures?.downAccMin ?? 0) + open;
}
