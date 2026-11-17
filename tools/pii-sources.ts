import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * PII deny-list (ticket 01), derived at run time from the tracked source files. No real value is ever
 * written to code, tests, fixtures or logs.
 */

export const SOURCES = {
  users: 'docs/discovery/real-2026-11-13/live/users.json',
  tickets: 'docs/discovery/real-2026-11-13/live/tickets-export.json',
  workbook: 'docs/discovery/real-2026-11-13/cosmos-export-2026-11-11.xlsx',
};

export interface DenyList {
  names: string[];
  phones: string[];
}

export interface SourceTexts {
  users?: string;
  tickets?: string;
  workbook?: string;
}

export const PHONE = /(?<![\w.+])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\w.])/g;

const TICKET_NAME_FIELDS = [
  'reportedBy',
  'startedBy',
  'closedBy',
  'assignedTo',
  'transferTo',
  'pausedBy',
];
const NAME_HEADERS = new Set([
  'name',
  'done by',
  'supported by',
  'observed by',
  'reviewed by',
  'completed by',
  'prod. supervisor',
  'maint. supervisor',
]);
const NAME_SPLIT = /[,&/+]|\band\b/i;
const GENERIC =
  /^(?:operator|opeator|opeartor|setter|engineer|supervisor|admin|store|technician|maintenance|maint\.?|vendor|production|none|n\/?a)$|\bteam\b|^cell\s*\d+$/i;

/** Names that are also ordinary English words: the repository scan flags only the capitalised form. */
export const ENGLISH_WORDS = new Set(['meet']);

/** The project's own principals: coded in fixtures, never flagged in prose (docs and code comments). */
export const SCAN_PRINCIPALS = new Set(['bhavin', 'bhavin p', 'bhaven', 'nimish']);

/** A role or other label that is not a person ("Operator", "Setter", a misspelling of them). */
export const isGenericLabel = (name: string): boolean => GENERIC.test(name.trim());

export function normalisePhone(value: string): string {
  return value.replace(/\D/g, '').slice(-10);
}

function unescapeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function workbookCells(
  text: string,
): { sheet: number; col: string; row: number; value: string }[] {
  const sheets = text.split('<worksheet').slice(1);
  if (sheets.length === 0) throw new Error('pii: workbook has no readable worksheets');
  const cells: { sheet: number; col: string; row: number; value: string }[] = [];
  const cell =
    /<c r="([A-Z]+)(\d+)"[^>]*>(?:<f>[^<]*<\/f>)?(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)/g;
  sheets.forEach((sheet, index) => {
    for (const match of sheet.matchAll(cell)) {
      const raw = match[3] ?? match[4] ?? '';
      cells.push({
        sheet: index + 1,
        col: match[1] ?? '',
        row: Number(match[2]),
        value: unescapeXml(raw),
      });
    }
  });
  return cells;
}

const strings = (values: unknown[]): string[] =>
  values.filter((value): value is string => typeof value === 'string');

function userNames(text: string): string[] {
  const users = (JSON.parse(text) as { users?: { name?: unknown }[] }).users ?? [];
  return strings(users.map((user) => user.name));
}

function ticketNames(text: string): string[] {
  type Ticket = Record<string, unknown> & { crew?: { name?: unknown }[] };
  const tickets = (JSON.parse(text) as { tickets?: Ticket[] }).tickets ?? [];
  return tickets.flatMap((ticket) =>
    strings([
      ...TICKET_NAME_FIELDS.map((field) => ticket[field]),
      ...(ticket.crew ?? []).map((member) => member.name),
    ]),
  );
}

function workbookNames(text: string): string[] {
  const cells = workbookCells(text);
  const headerRow = new Map<string, number>();
  for (const c of cells) {
    if (!NAME_HEADERS.has(c.value.trim().toLowerCase())) continue;
    const key = `${c.sheet}:${c.col}`;
    headerRow.set(key, Math.min(headerRow.get(key) ?? c.row, c.row));
  }
  return cells
    .filter((c) => c.row > (headerRow.get(`${c.sheet}:${c.col}`) ?? Infinity))
    .map((c) => c.value);
}

function nameCandidates(texts: SourceTexts): string[] {
  return [
    ...(texts.users === undefined ? [] : userNames(texts.users)),
    ...(texts.tickets === undefined ? [] : ticketNames(texts.tickets)),
    ...(texts.workbook === undefined ? [] : workbookNames(texts.workbook)),
  ];
}

function lettersIn(text: string): number {
  return (text.match(/\p{L}/gu) ?? []).length;
}

/** The workbook without its machine registers (sheets with a "Serial No" header): a model number can look like a phone. */
function peopleSheets(text: string): string {
  return text
    .split('<worksheet')
    .slice(1)
    .filter((sheet) => !/>\s*Serial No\s*</i.test(sheet))
    .map((sheet) => `<worksheet${sheet}`)
    .join('');
}

export function denyListFromSources(texts: SourceTexts): DenyList {
  const names = new Set<string>();
  for (const candidate of nameCandidates(texts)) {
    for (const part of candidate.split(NAME_SPLIT)) {
      const name = part.trim().replace(/\s+/g, ' ');
      if (lettersIn(name) < 3 || GENERIC.test(name)) continue;
      names.add(name.toLowerCase());
    }
  }
  const phones = new Set<string>();
  const workbook = texts.workbook === undefined ? undefined : peopleSheets(texts.workbook);
  for (const text of [texts.users, texts.tickets, workbook]) {
    for (const match of text?.matchAll(PHONE) ?? []) phones.add(normalisePhone(match[0]));
  }
  return { names: [...names], phones: [...phones] };
}

export function loadDenyList(root = process.cwd()): DenyList {
  const texts: SourceTexts = {};
  for (const key of ['users', 'tickets', 'workbook'] as const) {
    const full = join(root, SOURCES[key]);
    if (!existsSync(full)) throw new Error(`pii: source list missing: ${SOURCES[key]}`);
    texts[key] = readFileSync(full, 'utf8');
  }
  return denyListFromSources(texts);
}
