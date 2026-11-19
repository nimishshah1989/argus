import { z } from 'zod';
import {
  assertSafeJson,
  canonicalJson,
  canonicalSha256,
  IMPORT_LIMITS,
  normalizeCode,
  normalizeKey,
  SYNTHETIC_SOURCE,
} from './json.js';
import { addIssue, short, stateSchema, figuresSchema, ticketSchema } from './ticket-schema.js';

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
export type EntryType = 'ordinary' | 'pastBreakdown' | 'pastUtility';
/** The channel a ticket is raised through: only a live import is `import`; every past row is `backfill`. */
export const channelOfEntry = (entryType: EntryType): 'import' | 'backfill' =>
  entryType === 'ordinary' ? 'import' : 'backfill';
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
export type { BhavinCrew, BhavinReport, BhavinSegment } from './ticket-schema.js';

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
