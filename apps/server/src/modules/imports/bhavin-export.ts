import { z } from 'zod';

/** Bhavin's real `GET /api/export` (his field names). Only what the importer reads is checked. */
export const REAL_SOURCE = 'argus.bhavin-export/v1' as const;

const text = z.string();
const nullableText = z.string().nullable();
const mins = z.number().nullable();

const eventSchema = z.object({
  at: text,
  type: text,
  by: text,
  text,
  eta: text,
  spare: text,
  mins,
});
const crewSchema = z.object({
  name: text,
  role: text,
  joinedAt: text,
  left: nullableText,
  leftWhy: z.string().nullable().optional(),
  running: z.boolean().optional(),
  segStart: nullableText.optional(),
});
const realTicketSchema = z.object({
  id: text,
  ref: text,
  machine: text,
  kind: z.enum(['stopped', 'support', 'general']),
  status: z.enum(['open', 'working', 'waiting', 'closed', 'cancelled']),
  downAt: text,
  reportedBy: text,
  problem: text,
  startedAt: nullableText,
  startedBy: text,
  closedAt: nullableText,
  closedBy: text,
  closeKind: text,
  closeNote: text,
  location: text,
  workType: text,
  selfStarted: z.boolean(),
  parentRef: text,
  eta: text,
  waitReason: text,
  waitSpare: z.boolean(),
  waitSince: nullableText,
  pausedBy: text,
  assignedTo: text,
  transferTo: text,
  transfers: z.number(),
  handedOver: z.boolean(),
  handoverSince: nullableText,
  segStart: nullableText,
  urgent: z.boolean(),
  editedAt: nullableText,
  taskExp: text,
  taskWhy: text,
  taskDownMin: mins,
  runningAt: nullableText,
  stopAt: nullableText,
  responseMin: mins,
  repairMin: mins,
  activeMin: z.number(),
  waitMin: z.number(),
  vendorMin: z.number(),
  handoverWaitMin: z.number(),
  downAcc: z.number(),
  downtimeMin: mins,
  followMin: mins,
  crew: z.array(crewSchema),
  report: z.record(z.unknown()).nullable(),
  events: z.array(eventSchema),
});
export type RealEvent = z.infer<typeof eventSchema>;
export type RealTicket = z.infer<typeof realTicketSchema>;

export interface RealExport {
  tickets: RealTicket[];
}

/**
 * True for an export in Bhavin's own shape: no `argus.synthetic-bhavin/v1` contract, and every ticket carries his
 * `downAt` and `events`. An empty list or any other `source` falls through to the synthetic parser, which refuses it.
 */
export function looksLikeBhavinExport(input: unknown): boolean {
  const tickets = (input as { tickets?: unknown } | null)?.tickets;
  return (
    Array.isArray(tickets) &&
    tickets.length > 0 &&
    (input as { source?: unknown }).source !== 'argus.synthetic-bhavin/v1' &&
    tickets.every((t) => typeof t === 'object' && t !== null && 'downAt' in t && 'events' in t)
  );
}

export function parseBhavinExport(input: unknown): RealExport {
  return z.object({ tickets: z.array(realTicketSchema) }).parse(input);
}
