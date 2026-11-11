import { createHash } from 'node:crypto';

export const SYNTHETIC_SOURCE = 'argus.synthetic-bhavin/v1' as const;
export const IMPORT_LIMITS = {
  fileBytes: 5_242_880,
  rawTicketBytes: 262_144,
  eventPayloadBytes: 8_192,
  tickets: 2_000,
  events: 2_000,
  crew: 128,
  segments: 2_000,
  reports: 1,
  reportPeoplePerRole: 128,
  editChanges: 10,
  aliasesPerKind: 512,
  jsonDepth: 16,
  payloadDepth: 8,
  shortString: 256,
  freeText: 4_096,
} as const;

function assertNoNul(value: string): void {
  if (value.includes('\0')) throw new Error('NUL is not allowed in JSON strings or keys');
}

function assertPrimitiveJson(value: unknown): boolean {
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'string') {
    assertNoNul(value);
    return true;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('JSON numbers must be finite');
    return true;
  }
  return false;
}

function assertJson(value: unknown, depth: number, ancestors: Set<object>): void {
  if (depth > IMPORT_LIMITS.jsonDepth) throw new Error('JSON depth exceeds 16');
  if (assertPrimitiveJson(value)) return;
  if (value === null || typeof value !== 'object') {
    throw new Error('Only plain JSON values are allowed');
  }
  if (ancestors.has(value)) throw new Error('JSON cycles are not allowed');
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (const child of value) assertJson(child, depth + 1, ancestors);
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('Only plain JSON objects are allowed');
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new Error('Only string JSON keys are allowed');
    }
    for (const [key, child] of Object.entries(value)) {
      assertNoNul(key);
      assertJson(child, depth + 1, ancestors);
    }
  }
  ancestors.delete(value);
}

export function assertSafeJson(value: unknown): void {
  assertJson(value, 1, new Set());
}

function sortedJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedJson);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortedJson((value as Record<string, unknown>)[key])]),
  );
}

export function canonicalJson(value: unknown): string {
  assertSafeJson(value);
  return JSON.stringify(sortedJson(value));
}

export function canonicalSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function normalizeKey(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function normalizeCode(value: string): string {
  return normalizeKey(value).toUpperCase();
}

function leapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function assertDateParts(year: number, month: number, day: number): void {
  const days = [31, leapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > (days[month - 1] ?? 0)) {
    throw new Error('Invalid calendar date');
  }
}

export function strictCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Date must use YYYY-MM-DD');
  assertDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
  return value;
}

function assertOffset(offset: string): void {
  if (offset === 'Z') return;
  const hour = Number(offset.slice(1, 3));
  const minute = Number(offset.slice(4, 6));
  if (hour > 14 || minute > 59 || (hour === 14 && minute !== 0)) {
    throw new Error('Invalid timestamp offset');
  }
}

export function strictIsoTimestamp(value: string): Date {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new Error('Timestamp must use strict ISO syntax with a zone');
  strictCalendarDate(match[1] as string);
  if (Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) {
    throw new Error('Invalid timestamp time');
  }
  assertOffset(match[5] as string);
  return new Date(value);
}
