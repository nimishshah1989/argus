import type { PoolClient } from 'pg';
import { z } from 'zod';

const eventSchema = z.object({
  type: z.string().min(1),
  at: z.coerce.date(),
  by: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  payload: z.record(z.unknown()).optional().default({}),
});

const crewSchema = z.object({
  person: z.string().min(1),
  role: z.enum(['lead', 'primary', 'support']),
  joinedAt: z.coerce.date(),
  leftAt: z.coerce.date().nullable().optional(),
  leftReason: z.string().nullable().optional(),
});

const segmentSchema = z.object({
  person: z.string().min(1),
  role: z.enum(['lead', 'primary', 'support']),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().nullable().optional(),
  endReason: z.string().nullable().optional(),
});

const reportSchema = z.object({
  kind: z.literal('breakdown'),
  problem: z.string().min(1),
  date: z.string().optional(),
  shiftCode: z.string().optional(),
  observedBy: z.string().nullable().optional(),
  correctiveAction: z.string().nullable().optional(),
  downtimeMin: z.number().int().min(0).optional(),
  responseMin: z.number().int().min(0).optional(),
  repairMin: z.number().int().min(0).optional(),
  breakdownCategory: z.string().nullable().optional(),
  maintCode: z.string().nullable().optional(),
  spareUsed: z.string().nullable().optional(),
  rootCause: z.string().nullable().optional(),
  handoverName: z.string().nullable().optional(),
  doneBy: z.array(z.string()).optional(),
  supportedBy: z.array(z.string()).optional(),
});

const ticketSchema = z.object({
  legacyId: z.string(),
  ref: z.string().min(1),
  kind: z.enum(['stopped', 'support', 'general']),
  status: z.enum(['open', 'working', 'waiting', 'closed', 'cancelled']),
  machineCode: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  workType: z.string().nullable().optional(),
  problem: z.string(),
  reportedAt: z.coerce.date(),
  reportedByPerson: z.string().nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  closedAt: z.coerce.date().nullable().optional(),
  cancelledAt: z.coerce.date().nullable().optional(),
  closeKind: z.enum(['report', 'no_report', 'done']).nullable().optional(),
  closeNote: z.string().nullable().optional(),
  leadPerson: z.string().nullable().optional(),
  parentRef: z.string().nullable().optional(),
  events: z.array(eventSchema).optional().default([]),
  crew: z.array(crewSchema).optional().default([]),
  segments: z.array(segmentSchema).optional().default([]),
  reports: z.array(reportSchema).optional().default([]),
});

export const bhavinExportSchema = z.object({
  source: z.string(),
  tickets: z.array(z.unknown()),
});

export type BhavinExport = z.infer<typeof bhavinExportSchema>;
export type BhavinTicket = z.infer<typeof ticketSchema>;
export type BhavinReport = z.infer<typeof reportSchema>;

export interface ImportStats {
  tickets: number;
  imported: number;
  skipped: number;
  errored: number;
  events: number;
  crew: number;
  segments: number;
}

export interface Machine {
  id: string;
  snapshot: Record<string, unknown>;
}

export interface ImportCtx {
  client: PoolClient;
  tenantId: string;
}

export interface TicketImport {
  ticketId: string;
  ticket: BhavinTicket;
  machine: Machine | null;
  people: Map<string, string>;
}

export interface ImportedRow {
  ref: string;
  parentRef: string | null;
  ticketId: string;
}

export interface Progress {
  stats: ImportStats;
  refToId: Map<string, string>;
  imported: ImportedRow[];
}

export interface RowInput {
  batchId: string;
  rowNumber: number;
  raw: unknown;
}

/** Legacy machine-code prefix aliases (N12); a null value marks an inactive code to skip. */
const MACHINE_PREFIX_ALIASES: Record<string, string | null> = {
  MEC: 'M',
  NI: 'MIS',
  INT: 'MIS',
  FS: 'MIS',
  PP: 'MIS',
  UTI: 'MIS',
  ELE: null,
  HYD: null,
  ROT: null,
};

export function resolveMachineCode(code: string): string | null {
  const dash = code.indexOf('-');
  const prefix = dash < 0 ? code : code.slice(0, dash);
  const alias = MACHINE_PREFIX_ALIASES[prefix];
  if (alias === null) return null;
  if (alias === undefined) return code;
  return dash < 0 ? alias : `${alias}${code.slice(dash)}`;
}

export function orNull<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseTicket(raw: unknown): BhavinTicket {
  return ticketSchema.parse(raw);
}
