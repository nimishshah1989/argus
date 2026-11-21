import type { DrillReply, DrillReplyRow } from '@uptimo/shared/analytics';
import { fill } from '../../../i18n/fill.js';
import type { EntityChipProps } from '../entity-chip.js';
import type { RowCell, RowsBehindColumn, RowsBehindModel, RowsBehindRow } from './rows-behind.js';

type MachineRow = Extract<DrillReplyRow, { code: string }>;
type TicketRow = Extract<DrillReplyRow, { ref: string }>;
type MoveRow = Extract<DrillReplyRow, { effectiveFrom: string }>;
type Type = DrillReply['type'];

/** Every word the adapter prints, in the reader's language; the screen brings them, as it does for any model. */
export type RowsBehindAdapterWords = {
  /** The locale dates and numbers are written in, e.g. `en-IN`. */
  locale: string;
  /** What each kind of row is, with `{n}`: "{n} tickets". */
  counted: Record<Type, string>;
  /** `{date}` is the plant date the rows were counted for. */
  source: string;
  /** A cell with nothing in it. */
  none: string;
  /** `{n}` is the cell's name: "Cell {n}". */
  cell: string;
  /** `{n}` hours: "{n} h". */
  hours: string;
  columns: {
    machine: string;
    cell: string;
    type: string;
    makeModel: string;
    year: string;
    status: string;
    ticket: string;
    reported: string;
    downtime: string;
    work: string;
    from: string;
    to: string;
    movedOn: string;
    location: string;
    /** The load columns of the energy figure's machines: rated power, and the share of it the plant runs. */
    connectedKva: string;
    runningKva: string;
  };
  ticketStatus: Record<TicketRow['status'], string>;
  ticketKind: Record<TicketRow['kind'], string>;
  machineStatus: Record<MachineRow['status'], string>;
};

/**
 * What each row type's reply fields become. `shown` fields are printed or used to filter; `elsewhere` fields are not
 * in this table on purpose, because the thing the row opens (the machine's drawer and page, the ticket's page) is
 * where they are read. A test holds the two lists against the reply schema, so a new field cannot go missing quietly.
 */
export const REPLY_FIELDS: Record<Type, { shown: string[]; elsewhere: string[] }> = {
  machine: {
    shown: [
      'code',
      'cell',
      'category',
      'make',
      'model',
      'year',
      'status',
      'segment',
      'powerKw',
      'metadata',
    ],
    elsewhere: [
      'id',
      'location',
      'serial',
      'controller',
      'controllerModel',
      'controllerSerial',
      'purchasedOn',
      'capacityKva',
      'assetCode',
      'criticality',
      'excludedFromProduction',
    ],
  },
  ticket: {
    shown: ['ref', 'machineId', 'reportedAt', 'downtimeMin', 'workType', 'status', 'kind'],
    elsewhere: ['id', 'closedAt', 'source', 'repairMin'],
  },
  move: {
    shown: ['machineId', 'fromCell', 'toCell', 'effectiveFrom', 'fromLocation', 'toLocation'],
    elsewhere: ['id'],
  },
};

/**
 * The load the energy figure counts, for the machines behind it: the plant's efficiency factor, which a machine's own
 * `efficiency` (0 to 100) replaces, exactly as the engine's `a5-energy` sums running load machine by machine.
 */
export type LoadBasis = { factorPct: number };

type Ctx = {
  words: RowsBehindAdapterWords;
  load?: LoadBasis;
  machineCode: (id: string) => string | undefined;
  day: (value: string) => string;
};

/** A date as DD-MMM-YYYY in the plant's time zone. */
function dayFormat(locale: string): (value: string) => string {
  const parts = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  return (value) => {
    const at = new Date(value.length === 10 ? `${value}T00:00:00+05:30` : value);
    return parts
      .formatToParts(at)
      .filter((p) => p.type === 'day' || p.type === 'month' || p.type === 'year')
      .map((p) => p.value)
      .join('-');
  };
}

const text = (value: string): RowCell => ({ text: value });
const orNone = (ctx: Ctx, value: string | null | undefined): RowCell =>
  text(value === null || value === undefined || value === '' ? ctx.words.none : value);

const machineChip = (code: string): EntityChipProps => ({ kind: 'machine', id: code, label: code });

/** A machine a row names by id: its chip, or a dash when the plant has no such machine (an id is never printed). */
function machineCell(ctx: Ctx, id: string): RowCell {
  const code = ctx.machineCode(id);
  return code === undefined ? text(ctx.words.none) : { text: code, chip: machineChip(code) };
}

function cellCell(ctx: Ctx, cell: string | null): RowCell {
  if (cell === null) return text(ctx.words.none);
  const label = fill(ctx.words.cell, { n: cell });
  return { text: label, chip: { kind: 'cell', id: cell, label } };
}

const column = (
  key: string,
  label: string,
  sortable = true,
  numeric = false,
): RowsBehindColumn => ({
  key,
  label,
  sortable,
  numeric,
});

type Built = {
  columns: RowsBehindColumn[];
  rows: RowsBehindRow[];
  sort: RowsBehindModel['initialSort'];
};

const oneDecimal = (ctx: Ctx, n: number) =>
  n.toLocaleString(ctx.words.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** A machine's own efficiency when its metadata carries one (clamped 0 to 100), else the plant's factor. */
function efficiencyOf(row: MachineRow, factorPct: number): number {
  const own = Number(row.metadata.efficiency);
  const has = row.metadata.efficiency !== undefined && row.metadata.efficiency !== null;
  return has && Number.isFinite(own) ? Math.min(100, Math.max(0, own)) : factorPct;
}

/** Connected (rated) and running load of one machine; a machine with no rated power prints a dash and adds no load. */
function loadCells(row: MachineRow, ctx: Ctx, load: LoadBasis): Record<string, RowCell> {
  if (row.powerKw === null || !Number.isFinite(row.powerKw))
    return {
      connectedKva: { ...text(ctx.words.none), sort: -1 },
      runningKva: { ...text(ctx.words.none), sort: -1 },
    };
  const running = (row.powerKw * efficiencyOf(row, load.factorPct)) / 100;
  return {
    connectedKva: { text: oneDecimal(ctx, row.powerKw), sort: row.powerKw },
    runningKva: { text: oneDecimal(ctx, running), sort: running },
  };
}

function machines(rows: MachineRow[], ctx: Ctx): Built {
  const c = ctx.words.columns;
  const { load } = ctx;
  return {
    columns: [
      column('machine', c.machine),
      column('cell', c.cell),
      ...(load
        ? [
            column('connectedKva', c.connectedKva, true, true),
            column('runningKva', c.runningKva, true, true),
          ]
        : []),
      column('type', c.type),
      column('makeModel', c.makeModel),
      column('year', c.year, true, true),
      column('status', c.status),
    ],
    sort: { key: 'machine', dir: 'asc' },
    rows: rows.map((r) => ({
      key: r.code,
      tags: [`segment:${r.segment ?? ''}`, `status:${r.status}`],
      open: { chip: machineChip(r.code) },
      cells: {
        machine: { text: r.code, chip: machineChip(r.code) },
        cell: cellCell(ctx, r.cell),
        ...(load ? loadCells(r, ctx, load) : {}),
        type: orNone(ctx, r.category),
        makeModel: orNone(ctx, [r.make, r.model].filter(Boolean).join(' ')),
        year: { ...orNone(ctx, r.year?.toString()), sort: r.year ?? 0 },
        status: text(ctx.words.machineStatus[r.status]),
      },
    })),
  };
}

function tickets(rows: TicketRow[], ctx: Ctx): Built {
  const c = ctx.words.columns;
  const hours = (min: number) =>
    fill(ctx.words.hours, {
      n: (min / 60).toLocaleString(ctx.words.locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    });
  return {
    columns: [
      column('ticket', c.ticket),
      column('machine', c.machine),
      column('downtime', c.downtime, true, true),
      column('reported', c.reported),
      column('work', c.work),
      column('status', c.status),
    ],
    sort: { key: 'reported', dir: 'desc' },
    rows: rows.map((r) => ({
      key: r.ref,
      tags: [`status:${r.status}`, `kind:${r.kind}`],
      open: { href: `/desk/${encodeURIComponent(r.id)}` },
      cells: {
        ticket: { text: r.ref, href: `/desk/${encodeURIComponent(r.id)}` },
        machine: r.machineId === null ? text(ctx.words.none) : machineCell(ctx, r.machineId),
        reported: { text: ctx.day(r.reportedAt), sort: r.reportedAt },
        downtime:
          r.downtimeMin === null
            ? { text: ctx.words.none, sort: -1 }
            : { text: hours(r.downtimeMin), sort: r.downtimeMin },
        work: orNone(ctx, r.workType),
        status: text(ctx.words.ticketStatus[r.status]),
      },
    })),
  };
}

function moves(rows: MoveRow[], ctx: Ctx): Built {
  const c = ctx.words.columns;
  return {
    columns: [
      column('machine', c.machine),
      column('from', c.from),
      column('to', c.to),
      column('movedOn', c.movedOn),
      column('location', c.location, false),
    ],
    sort: { key: 'movedOn', dir: 'desc' },
    rows: rows.map((r) => {
      const code = ctx.machineCode(r.machineId) ?? ctx.words.none;
      const where = [r.fromLocation, r.toLocation].filter(Boolean).join(' → ');
      return {
        key: `${code} ${r.effectiveFrom}`,
        tags: [],
        open:
          code === ctx.words.none ? { href: '/analytics/machines' } : { chip: machineChip(code) },
        cells: {
          machine: machineCell(ctx, r.machineId),
          from: cellCell(ctx, r.fromCell),
          to: cellCell(ctx, r.toCell),
          movedOn: { text: ctx.day(r.effectiveFrom), sort: r.effectiveFrom },
          location: orNone(ctx, where),
        },
      };
    }),
  };
}

/** The two to four chips that best narrow these rows, after "All": the first column of tags that splits them that way. */
function filtersFor(rows: RowsBehindRow[], dimensions: [string, (value: string) => string][]) {
  for (const [name, label] of dimensions) {
    const values = [
      ...new Set(rows.flatMap((r) => r.tags.filter((t) => t.startsWith(`${name}:`)))),
    ].sort();
    const useful = values.filter((tag) => tag.length > name.length + 1);
    if (useful.length >= 2 && useful.length <= 4)
      return useful.map((key) => ({ key, label: label(key.slice(name.length + 1)) }));
  }
  return [];
}

/**
 * The rows behind a figure, from the drill reply the server already sends (`GET /analytics/drill`), as the panel
 * prints them. Nothing is recomputed: the figure's value arrives as printed, a row's fields are only formatted.
 * `machineCode` turns a ticket's machine id into the code a chip names it by; null when the reply has no rows, so the
 * screen shows the designed empty state.
 */
export function rowsBehindModel(input: {
  figure: { key: string; label: string; value: string };
  reply: DrillReply;
  /** The plant date the figures are as of, `YYYY-MM-DD`. */
  asOf: string;
  machineCode: (id: string) => string | undefined;
  words: RowsBehindAdapterWords;
  /** Set for the energy figure: its machines also print their connected and running load. */
  load?: LoadBasis;
}): RowsBehindModel | null {
  const { figure, reply, asOf, machineCode, words, load } = input;
  if (reply.rows.length === 0) return null;
  const ctx: Ctx = { words, machineCode, day: dayFormat(words.locale), ...(load ? { load } : {}) };
  const built =
    reply.type === 'machine'
      ? machines(reply.rows as MachineRow[], ctx)
      : reply.type === 'ticket'
        ? tickets(reply.rows as TicketRow[], ctx)
        : moves(reply.rows as MoveRow[], ctx);
  const dims: [string, (value: string) => string][] =
    reply.type === 'machine'
      ? [
          ['segment', (v) => v],
          ['status', (v) => words.machineStatus[v as MachineRow['status']]],
        ]
      : reply.type === 'ticket'
        ? [
            ['status', (v) => words.ticketStatus[v as TicketRow['status']]],
            ['kind', (v) => words.ticketKind[v as TicketRow['kind']]],
          ]
        : [];
  return {
    figure: figure.key,
    label: figure.label,
    value: figure.value,
    counted: fill(words.counted[reply.type], { n: reply.rows.length.toLocaleString(words.locale) }),
    source: fill(words.source, { date: ctx.day(asOf) }),
    columns: built.columns,
    rows: built.rows,
    filters: filtersFor(built.rows, dims),
    initialSort: built.sort,
  };
}
