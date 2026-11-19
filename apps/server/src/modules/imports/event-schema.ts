import { z, type ZodType } from 'zod';
import { assertSafeJson, canonicalJson, IMPORT_LIMITS, strictIsoTimestamp } from './json.js';

export interface BhavinEditChange {
  field:
    | 'reportedAt'
    | 'startedAt'
    | 'closedAt'
    | 'problem'
    | 'machineCode'
    | 'kind'
    | 'leadPerson'
    | 'closedByPerson'
    | 'handsOnOverrideMin'
    | 'waitingOverrideMin';
  from: unknown;
  to: unknown;
}

type Event<Type, Payload> = {
  type: Type;
  at: Date;
  by: string | null;
  text: string | null;
  payload: Payload;
};
type Empty = Record<string, never>;

export type BhavinEvent =
  | Event<'down' | 'start' | 'pickup' | 'running' | 'stopped' | 'upgrade_kind', Empty>
  | Event<'join', { role: 'primary' | 'support' }>
  | Event<'leave' | 'restore' | 'resume' | 'report', Empty>
  | Event<
      'pause',
      {
        reason: string;
        assignTo: string | null;
        expectedBackAt: Date | null;
        isVendor: boolean;
      }
    >
  | Event<'transfer', { to: string | null; toShift: string | null }>
  | Event<'update', { spare: string | null; expectedBackAt: Date | null }>
  | Event<'close', { kind: 'report' | 'no_report' | 'done' }>
  | Event<'utility_loss', { machineCode: string; minutes: number; code: string | null }>
  | Event<'cancel', { previousStatus: 'open' | 'working' | 'waiting' }>
  | Event<'edit', { changes: BhavinEditChange[] }>;

const timestamp = z.string().transform((value, context) => {
  try {
    return strictIsoTimestamp(value);
  } catch (error) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: (error as Error).message });
    return z.NEVER;
  }
});
const noNul = (value: string) => !value.includes('\0');
const short = z.string().min(1).max(IMPORT_LIMITS.shortString).refine(noNul, 'NUL is not allowed');
const free = z.string().max(IMPORT_LIMITS.freeText).refine(noNul, 'NUL is not allowed');
const nullableShort = short.nullable();
const minute = z.number().int().min(0).max(1_000_000);
const empty = z.object({}).strict();

function event<Type extends string, Payload extends z.ZodTypeAny>(type: Type, payload: Payload) {
  return z
    .object({
      type: z.literal(type),
      at: timestamp,
      by: nullableShort,
      text: free.nullable(),
      payload,
    })
    .strict();
}

function change<Field extends string>(field: Field, from: z.ZodTypeAny, to: z.ZodTypeAny) {
  return z.object({ field: z.literal(field), from, to }).strict();
}

const editChange = z.discriminatedUnion('field', [
  change('reportedAt', timestamp, timestamp),
  change('startedAt', timestamp.nullable(), timestamp),
  change('closedAt', timestamp.nullable(), timestamp),
  change('problem', free, free),
  change('machineCode', nullableShort, nullableShort),
  change(
    'kind',
    z.enum(['stopped', 'support', 'general']),
    z.enum(['stopped', 'support', 'general']),
  ),
  change('leadPerson', nullableShort, nullableShort),
  change('closedByPerson', nullableShort, nullableShort),
  change('handsOnOverrideMin', minute.nullable(), minute),
  change('waitingOverrideMin', minute.nullable(), minute),
]);
const editPayload = z
  .object({ changes: z.array(editChange) })
  .strict()
  .superRefine((payload, context) => {
    if (payload.changes.length > IMPORT_LIMITS.editChanges) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['changes'], message: 'array_cap' });
      return;
    }
    const fields = payload.changes.map((item) => item.field);
    if (new Set(fields).size !== fields.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['changes'],
        message: 'duplicate_field',
      });
    }
  });

function jsonDepth(value: unknown): number {
  const children = Array.isArray(value)
    ? value
    : value !== null && typeof value === 'object'
      ? Object.values(value)
      : [];
  let deepest = 0;
  for (const child of children) deepest = Math.max(deepest, jsonDepth(child));
  return deepest + 1;
}

function assertEventPayload(payload: unknown): void {
  assertSafeJson(payload);
  if (jsonDepth(payload) > IMPORT_LIMITS.payloadDepth) {
    throw new Error(`payload_depth: event payload depth exceeds ${IMPORT_LIMITS.payloadDepth}`);
  }
  const bytes = Buffer.byteLength(canonicalJson(payload));
  if (bytes > IMPORT_LIMITS.eventPayloadBytes) {
    throw new Error(
      `payload_bytes: event payload exceeds ${IMPORT_LIMITS.eventPayloadBytes} canonical bytes`,
    );
  }
}

const transferPayload = z
  .object({ to: nullableShort, toShift: nullableShort })
  .strict()
  .refine((payload) => (payload.to === null) !== (payload.toShift === null), {
    message: 'Exactly one transfer target is required',
  });
const eventUnion = z
  .discriminatedUnion('type', [
    event('down', empty),
    event('start', empty),
    event('pickup', empty),
    event('running', empty),
    event('stopped', empty),
    event('upgrade_kind', empty),
    event('join', z.object({ role: z.enum(['primary', 'support']) }).strict()),
    event('leave', empty),
    event('restore', empty),
    event(
      'pause',
      z
        .object({
          reason: short,
          assignTo: nullableShort,
          expectedBackAt: timestamp.nullable(),
          isVendor: z.boolean(),
        })
        .strict(),
    ),
    event('resume', empty),
    event('transfer', transferPayload),
    event(
      'update',
      z.object({ spare: free.nullable(), expectedBackAt: timestamp.nullable() }).strict(),
    ),
    event('close', z.object({ kind: z.enum(['report', 'no_report', 'done']) }).strict()),
    event(
      'utility_loss',
      z.object({ machineCode: short, minutes: minute, code: nullableShort }).strict(),
    ),
    event('cancel', z.object({ previousStatus: z.enum(['open', 'working', 'waiting']) }).strict()),
    event('report', empty),
    event('edit', editPayload),
  ])
  .superRefine((event, context) => {
    const actors = new Set([
      'start',
      'pickup',
      'join',
      'leave',
      'restore',
      'pause',
      'resume',
      'transfer',
      'update',
      'cancel',
      'report',
      'edit',
    ]);
    const reasons = new Set(['leave', 'restore', 'transfer', 'update', 'cancel', 'edit']);
    if (event.type === 'utility_loss' && event.by !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['by'],
        message: 'A utility line has no actor',
      });
    }
    if (actors.has(event.type) && event.by === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['by'], message: 'Actor is required' });
    }
    if (reasons.has(event.type) && event.text === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['text'],
        message: 'Reason or note is required',
      });
    }
    if (event.type === 'report' && event.text !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['text'],
        message: 'Report text must be null',
      });
    }
  });

export const bhavinEventSchema: ZodType<BhavinEvent> = z
  .any()
  .superRefine((value, context) => {
    if (value !== null && typeof value === 'object' && 'payload' in value) {
      try {
        assertEventPayload((value as { payload: unknown }).payload);
      } catch (error) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['payload'],
          message: (error as Error).message,
        });
      }
    }
  })
  .transform((value) => eventUnion.parse(value) as BhavinEvent);
