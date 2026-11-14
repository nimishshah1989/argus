import { z } from 'zod';
import { bhavinEventSchema } from './event-schema.js';
import {
  assertSafeJson,
  canonicalJson,
  canonicalSha256,
  IMPORT_LIMITS,
  normalizeCode,
  normalizeKey,
  strictCalendarDate,
  strictIsoTimestamp,
  SYNTHETIC_SOURCE,
} from './json.js';

export {
  assertSafeJson,
  canonicalJson,
  canonicalSha256,
  IMPORT_LIMITS,
  normalizeCode,
  normalizeKey,
  strictCalendarDate,
  strictIsoTimestamp,
  SYNTHETIC_SOURCE,
} from './json.js';
export { bhavinEventSchema, type BhavinEditChange, type BhavinEvent } from './event-schema.js';

export interface AliasConfig {
  machines: Record<string, string>;
  people: Record<string, string>;
  maintenanceCodes: Record<string, string>;
}
export type EntryType = 'ordinary' | 'pastBreakdown';
export type BhavinState = z.infer<typeof stateSchema>;
export type StoredFigures = z.infer<typeof figuresSchema>;
export type BhavinTicket = z.infer<typeof ticketSchema>;
export interface SyntheticExport {
  source: typeof SYNTHETIC_SOURCE;
  aliases: AliasConfig;
  tickets: unknown[];
}
export interface StoredRawPayload {
  format: 'argus.import-raw/v1';
  raw: unknown;
  canonicalJson: string;
  rawSha256: string;
  identitySha256: string;
}
export type IssueSeverity = 'info' | 'warning' | 'error';
export interface ImportIssue {
  rowNumber: number;
  legacyId: string | null;
  ref: string | null;
  code: string;
  field: string | null;
  stored: number | null;
  computed: number | null;
  delta: number | null;
  severity: IssueSeverity;
  message: string;
}
export interface CompletionFingerprint {
  version: 1;
  algorithm: 'sha256';
  digest: string;
  tickets: Array<{ ticketId: string; legacyId: string; entryType: EntryType; digest: string }>;
}
export interface ImportStats {
  contract: typeof SYNTHETIC_SOURCE;
  status: 'done' | 'failed';
  tickets: number;
  imported: number;
  skipped: number;
  /** Rows that created a person whose name matches an erased one. Imported as usual; a person looks at them. */
  possiblyErasedMatches: number;
  errored: number;
  events: number;
  crew: number;
  segments: number;
  reports: number;
  reportPeople: number;
  pendingPeople: number;
  pendingPersons: string[];
  exactMatches: number;
  toleratedMismatches: number;
  hardMismatches: number;
  overridesApplied: number;
  parentRepairs: Array<{ rowNumber: number; ref: string; parentRef: string }>;
  issues: ImportIssue[];
  aliasSha256: string;
  refCounters: { BD: number | null; WR: number | null };
  fatal: { message: string } | null;
  completion: CompletionFingerprint | null;
}

const noNul = (value: string) => !value.includes('\0');
function addIssue(context: z.RefinementCtx, path: (string | number)[], message: string): void {
  context.addIssue({ code: z.ZodIssueCode.custom, path, message });
}
const short = z.string().min(1).max(IMPORT_LIMITS.shortString).refine(noNul, 'NUL is not allowed');
const free = z.string().max(IMPORT_LIMITS.freeText).refine(noNul, 'NUL is not allowed');
const requiredFree = z
  .string()
  .min(1)
  .max(IMPORT_LIMITS.freeText)
  .refine(noNul, 'NUL is not allowed');
const nullableShort = short.nullable();
const timestamp = z.string().transform((value, context) => {
  try {
    return strictIsoTimestamp(value);
  } catch (error) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: (error as Error).message });
    return z.NEVER;
  }
});
const nullableTimestamp = timestamp.nullable();
const calendarDate = z.string().transform((value, context) => {
  try {
    return strictCalendarDate(value);
  } catch (error) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: (error as Error).message });
    return z.NEVER;
  }
});
const minute = z.number().int().min(0).max(1_000_000);
const nullableMinute = minute.nullable();
const ref = z
  .string()
  .regex(/^(BD|WR)-([0-9]+)$/)
  .refine((value) => {
    const suffix = Number(value.slice(3));
    return Number.isSafeInteger(suffix) && suffix >= 1 && suffix <= 2_147_483_646;
  }, 'Reference suffix must be between 1 and 2147483646');

const stateSchema = z
  .object({
    selfStarted: z.boolean(),
    startedAt: nullableTimestamp,
    segmentStartedAt: nullableTimestamp,
    leadPerson: nullableShort,
    handedOver: z.boolean(),
    handoverSince: nullableTimestamp,
    transferToPerson: nullableShort,
    transferToShift: nullableShort,
    transfers: minute,
    waitReason: nullableShort,
    waitSince: nullableTimestamp,
    pausedByPerson: nullableShort,
    assignedToPerson: nullableShort,
    expectedBackAt: nullableTimestamp,
    waitingSpare: free.nullable(),
    machineRunningAt: nullableTimestamp,
    machineStoppedAt: nullableTimestamp,
    kindUpgradedAt: nullableTimestamp,
    closedAt: nullableTimestamp,
    closedByPerson: nullableShort,
    closeKind: z.enum(['report', 'no_report', 'done']).nullable(),
    closeNote: free.nullable(),
    cancelledAt: nullableTimestamp,
  })
  .strict();
const figuresSchema = z
  .object({
    responseMin: nullableMinute,
    activeMin: minute,
    waitMin: minute,
    vendorMin: minute,
    handoverWaitMin: minute,
    downAccMin: minute,
    downtimeMin: nullableMinute,
    followMin: nullableMinute,
    repairMin: minute,
  })
  .strict();
const crewSchema = z
  .object({
    person: short,
    role: z.enum(['lead', 'primary', 'support']),
    joinedAt: timestamp,
    leftAt: nullableTimestamp,
    leftReason: free.nullable(),
  })
  .strict()
  .superRefine((crew, context) => {
    if ((crew.leftAt === null) !== (crew.leftReason === null)) {
      addIssue(context, ['leftReason'], 'leftReason and leftAt must both be null or nonnull');
    }
  });
const segmentSchema = z
  .object({
    person: short,
    role: z.enum(['lead', 'primary', 'support']),
    startedAt: timestamp,
    endedAt: nullableTimestamp,
    endReason: z.enum(['pause', 'transfer', 'leave', 'close', 'cancel']).nullable(),
  })
  .strict()
  .superRefine((segment, context) => {
    if ((segment.endedAt === null) !== (segment.endReason === null)) {
      addIssue(context, ['endReason'], 'endReason and endedAt must both be null or nonnull');
    }
  });
export type BhavinCrew = z.infer<typeof crewSchema>;
export type BhavinSegment = z.infer<typeof segmentSchema>;

const reportSchema = z
  .object({
    kind: z.literal('breakdown'),
    problem: requiredFree,
    date: calendarDate,
    shiftCode: short,
    observedBy: nullableShort,
    correctiveAction: free.nullable(),
    downtimeMin: minute,
    responseMin: nullableMinute,
    repairMin: nullableMinute,
    breakdownCategory: nullableShort,
    maintCode: nullableShort,
    spareUsed: free.nullable(),
    rootCause: free.nullable(),
    handoverName: free.nullable(),
    doneBy: z.array(short).max(IMPORT_LIMITS.reportPeoplePerRole),
    supportedBy: z.array(short).max(IMPORT_LIMITS.reportPeoplePerRole),
    submittedAt: timestamp,
    submittedBy: short,
  })
  .strict()
  .superRefine((report, context) => {
    const done = report.doneBy.map(normalizeKey);
    const supported = report.supportedBy.map(normalizeKey);
    for (const [field, names] of [
      ['doneBy', done],
      ['supportedBy', supported],
    ] as const) {
      if (new Set(names).size !== names.length) {
        addIssue(context, [field], 'Duplicate normalized person');
      }
    }
    if (done.some((name) => supported.includes(name))) {
      addIssue(context, ['supportedBy'], 'Report people must be disjoint');
    }
  });
export type BhavinReport = z.infer<typeof reportSchema>;

const ticketSchema = z
  .object({
    legacyId: z.string().trim().min(1).max(128).refine(noNul, 'NUL is not allowed'),
    ref,
    entryType: z.enum(['ordinary', 'pastBreakdown']),
    kind: z.enum(['stopped', 'support', 'general']),
    status: z.enum(['open', 'working', 'waiting', 'closed', 'cancelled']),
    machineCode: nullableShort,
    location: nullableShort,
    workType: nullableShort,
    problem: requiredFree,
    reportedAt: timestamp,
    reportedByPerson: nullableShort,
    parentRef: ref.nullable(),
    state: stateSchema,
    events: z.array(bhavinEventSchema).max(IMPORT_LIMITS.events),
    crew: z.array(crewSchema).max(IMPORT_LIMITS.crew),
    segments: z.array(segmentSchema).max(IMPORT_LIMITS.segments),
    reports: z.array(reportSchema).max(IMPORT_LIMITS.reports),
    storedFigures: figuresSchema,
  })
  .strict()
  .superRefine((ticket, context) => {
    const breakdown = ticket.kind === 'stopped' || ticket.kind === 'support';
    if (breakdown && !ticket.ref.startsWith('BD-')) {
      addIssue(context, ['ref'], 'Breakdown tickets require BD');
    }
    if (!breakdown && !ticket.ref.startsWith('WR-')) {
      addIssue(context, ['ref'], 'General tickets require WR');
    }
    if (breakdown && ticket.machineCode === null) {
      addIssue(context, ['machineCode'], 'Machine is required');
    }
    if (
      !breakdown &&
      (ticket.machineCode !== null || ticket.location === null || ticket.workType === null)
    ) {
      addIssue(context, ['machineCode'], 'General tickets require null machine/location/workType');
    }
  })
  .superRefine((ticket, context) => {
    if (
      ticket.parentRef !== null &&
      (ticket.kind !== 'general' || !ticket.parentRef.startsWith('WR-'))
    ) {
      addIssue(context, ['parentRef'], 'A parent must be a general WR ticket');
    }
    if (ticket.parentRef === ticket.ref && ticket.parentRef !== null) {
      addIssue(context, ['parentRef'], 'Self parent is not allowed');
    }
    if (ticket.kind === 'general' && ticket.reports.length > 0) {
      addIssue(context, ['reports'], 'A report requires a ticket machine');
    }
  })
  .superRefine((ticket, context) => {
    if (ticket.entryType !== 'pastBreakdown') return;
    if (ticket.kind !== 'stopped')
      addIssue(context, ['entryType'], 'Past breakdown requires stopped/BD');
    for (const field of ['responseMin', 'repairMin'] as const) {
      if (ticket.reports.some((report) => report[field] === null)) {
        addIssue(context, ['reports', 0, field], 'Past breakdown report value is required');
      }
    }
  })
  .superRefine((ticket, context) => {
    ticket.events.forEach((event, index) => {
      if (event.type === 'down' && index !== 0) {
        addIssue(context, ['events', index, 'type'], 'down must be seq 0');
      }
    });
  });

const aliasesSchema = z
  .object({
    machines: z.record(short, short),
    people: z.record(short, short),
    maintenanceCodes: z.record(short, short),
  })
  .strict()
  .superRefine((aliases, context) => {
    for (const kind of ['machines', 'people', 'maintenanceCodes'] as const) {
      const entries = Object.entries(aliases[kind]);
      if (entries.length > IMPORT_LIMITS.aliasesPerKind) {
        addIssue(context, [kind], 'At most 512 aliases are allowed');
      }
      const seen = new Set<string>();
      for (const [key, target] of entries) {
        const normalize = kind === 'people' ? normalizeKey : normalizeCode;
        const normalized = normalize(key);
        if (!normalized || !normalize(target)) {
          addIssue(context, [kind, key], 'Alias key and target must be nonempty');
        }
        if (seen.has(normalized)) {
          addIssue(context, [kind, key], 'Duplicate normalized alias');
        }
        seen.add(normalized);
      }
    }
  });
const exportSchema = z
  .object({
    source: z.literal(SYNTHETIC_SOURCE),
    aliases: aliasesSchema,
    tickets: z.array(z.unknown()).max(IMPORT_LIMITS.tickets),
  })
  .strict();

export function parseSyntheticExport(input: unknown): SyntheticExport {
  z.object({ source: z.literal(SYNTHETIC_SOURCE) })
    .passthrough()
    .parse(input);
  assertSafeJson(input);
  return exportSchema.parse(input);
}

export function parseTicket(raw: unknown): BhavinTicket {
  const ticket = ticketSchema.parse(raw) as BhavinTicket;
  if (Buffer.byteLength(canonicalJson(raw)) > IMPORT_LIMITS.rawTicketBytes) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: `raw_ticket_bytes: raw ticket exceeds ${IMPORT_LIMITS.rawTicketBytes} canonical bytes`,
      },
    ]);
  }
  return ticket;
}

export function makeRawEnvelope(raw: unknown, aliases: AliasConfig): StoredRawPayload {
  if (raw === null) throw new Error('Raw ticket must be a JSON object');
  return {
    format: 'argus.import-raw/v1',
    raw,
    canonicalJson: canonicalJson(raw),
    rawSha256: canonicalSha256(raw),
    identitySha256: canonicalSha256({ ticket: raw, aliases }),
  };
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
