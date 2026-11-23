import type { MessageKey } from '@uptimo/shared/i18n';
import { bag, list, pickText, printable, text, texts } from './read-value.js';

/**
 * The registers and cell-change-log values (`registers`, `cell-change-log`). Both readers are pure and total:
 * an unknown or not-computed value is "nothing to show", never a made-up number. The engine's own KPI labels,
 * values and table strings are data; every label the screen itself adds is a catalogue key.
 */

/* ── Registers: one page per register, in the platform's own order ─────────────────────────────── */

export const REGISTER_ORDER = ['machines', 'conv', 'proc', 'util', 'dg', 'robots'] as const;
export type RegisterId = (typeof REGISTER_ORDER)[number];

/** The five registers the ticket names (robots is the platform's extra page, shown last when present). */
export const REGISTER_TABS: readonly { id: RegisterId; labelKey: MessageKey }[] = [
  { id: 'machines', labelKey: 'analytics.register.machines' },
  { id: 'conv', labelKey: 'analytics.register.conv' },
  { id: 'proc', labelKey: 'analytics.register.proc' },
  { id: 'util', labelKey: 'analytics.register.util' },
  { id: 'dg', labelKey: 'analytics.register.dg' },
  { id: 'robots', labelKey: 'analytics.register.robots' },
];

export interface RegisterKpi {
  label: string;
  value: string;
  sub: string | null;
}

export interface RegisterTable {
  title: string | null;
  header: string[];
  rows: string[][];
}

export interface RegisterPage {
  id: string;
  title: string;
  kpis: RegisterKpi[];
  tables: RegisterTable[];
}

function parseKpi(raw: unknown): RegisterKpi[] {
  const kpi = bag(raw);
  if (!kpi) return [];
  const label = text(kpi.label);
  const value = printable(kpi.value);
  if (label === null || value === null) return [];
  return [{ label, value, sub: text(kpi.sub) ?? printable(kpi.sub) }];
}

function parseTable(raw: unknown): RegisterTable[] {
  const table = bag(raw);
  if (!table) return [];
  const header = texts(table.header);
  const rows = list(table.rows).flatMap((row) => {
    const cells = list(row).map(printable);
    return cells.length > 0 && cells.every((cell) => cell !== null) ? [cells as string[]] : [];
  });
  if (header.length === 0 && rows.length === 0) return [];
  return [{ title: text(table.title), header, rows }];
}

function parsePage(raw: unknown): RegisterPage[] {
  const page = bag(raw);
  if (!page) return [];
  const id = text(page.page);
  const title = text(page.title);
  if (id === null || title === null) return [];
  return [
    {
      id,
      title,
      kpis: list(page.kpis).flatMap(parseKpi),
      tables: list(page.tables).flatMap(parseTable),
    },
  ];
}

/** The register pages a ready `registers` value carries, in the platform's order. */
export function registerPages(value: unknown): RegisterPage[] {
  const root = bag(value);
  if (!root) return [];
  const rank = (id: string) => {
    const index = (REGISTER_ORDER as readonly string[]).indexOf(id);
    return index === -1 ? REGISTER_ORDER.length : index;
  };
  return list(root.pages)
    .flatMap(parsePage)
    .sort((left, right) => rank(left.id) - rank(right.id));
}

/* ── Cell change log ───────────────────────────────────────────────────────────────────────────── */

export interface CellMove {
  id: string;
  machineId: string;
  /** The engine's date, ISO or the platform's DD-MM-YYYY; shown as it came. */
  date: string;
  fromCell: string | null;
  toCell: string | null;
  fromLocation: string | null;
  toLocation: string | null;
}

function parseMove(raw: unknown): CellMove[] {
  const move = bag(raw);
  if (!move) return [];
  const id = text(move.id);
  const machineId = pickText(move, 'machineId', 'machine');
  const date = pickText(move, 'date', 'effectiveFrom');
  if (id === null || machineId === null || date === null) return [];
  return [
    {
      id,
      machineId,
      date,
      fromCell: text(move.fromCell),
      toCell: text(move.toCell),
      fromLocation: text(move.fromLocation),
      toLocation: text(move.toLocation),
    },
  ];
}

/** A ready `cell-change-log` value: `{ moves }`, or a bare list, latest first as the platform shows it. */
export function cellMoves(value: unknown): CellMove[] {
  const root = bag(value);
  const raw = Array.isArray(value) ? value : list(root?.moves);
  return raw
    .flatMap(parseMove)
    .sort((left, right) => dayKey(right.date).localeCompare(dayKey(left.date)));
}

/** An ISO plant day as the platform writes it; anything else (already DD-MM-YYYY) stays as it came. */
export function displayDay(raw: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  return iso ? `${iso[3]}-${iso[2]}-${iso[1]}` : raw;
}

/** A sortable day: ISO stays, the platform's DD-MM-YYYY becomes ISO, anything else sorts as text. */
export function dayKey(raw: string): string {
  const platform = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  return platform ? `${platform[3]}-${platform[2]}-${platform[1]}` : raw;
}

/* ── Correcting one move's date ───────────────────────────────────────────────────────────────── */

/** The sheet's error shape: a 422 naming `effectiveFrom` sits under the date; anything else is the refusal line. */
export function correctionError(error: { field?: string; message: string }): {
  date?: string;
  message: string;
} {
  return error.field === 'effectiveFrom'
    ? { date: error.message, message: error.message }
    : { message: error.message };
}

/** The date the sheet chose, as the PATCH body the server reads. */
export function correctionBody(date: string): { effectiveFrom: string } {
  return { effectiveFrom: date };
}

/* ── The controlled-document export ───────────────────────────────────────────────────────────── */

export interface CellLogLabels {
  docNo: string;
  title: string;
  date: string;
  machine: string;
  fromCell: string;
  toCell: string;
  fromLocation: string;
  toLocation: string;
}

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** One CSV line per row, a field quoted only when it must be. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(csvField).join(',')).join('\n');
}

/**
 * The cell change log as the platform's controlled form exports it: the DOC. NO. line above the table, one row
 * per move. The number is the platform's own record number for the machinery lists (CE-MTN-F-01).
 */
export function cellLogCsv(
  moves: readonly CellMove[],
  codeOf: (machineId: string) => string | null,
  labels: CellLogLabels,
): string {
  const head = [
    labels.date,
    labels.machine,
    labels.fromCell,
    labels.toCell,
    labels.fromLocation,
    labels.toLocation,
  ];
  const rows = moves.map((move) => [
    displayDay(move.date),
    codeOf(move.machineId) ?? '—',
    move.fromCell ?? '',
    move.toCell ?? '',
    move.fromLocation ?? '',
    move.toLocation ?? '',
  ]);
  return `${toCsv([[labels.docNo], [labels.title], [], head, ...rows])}\n`;
}
