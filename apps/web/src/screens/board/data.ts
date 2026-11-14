import type { Group, Machine, Segment, Ticket, TicketStatus } from '../../api.js';
import { downNow } from '../../components/liveDowntime.js';

export type Column = 'notStarted' | 'repairing' | 'waiting';

/** The board's columns, left to right: who owns the next step on each stopped machine. */
export const COLUMNS: Column[] = ['notStarted', 'repairing', 'waiting'];

const COLUMN_OF: Partial<Record<TicketStatus, Column>> = {
  open: 'notStarted',
  working: 'repairing',
  waiting: 'waiting',
};

/** A stopped machine and the breakdown that stopped it; `ageMin` is its downtime so far. */
export interface Stop {
  machine: Machine;
  ticket: Ticket;
  ageMin: number;
}

export interface AgeBuckets {
  underHour: number;
  oneToFour: number;
  fourToDay: number;
  overDay: number;
}

export interface LiveBoard {
  /** Machines the board shows (#203: not in a hidden group, not in a segment kept off the board). */
  machines: number;
  running: number;
  stopped: number;
  /** Oldest first. */
  columns: Record<Column, Stop[]>;
  ages: AgeBuckets;
}

interface PlantConfig {
  machines: Machine[];
  segments: Segment[];
  groups: Group[];
}

const KIND_RANK: Record<string, number> = { stopped: 3, support: 2, general: 1 };
const STATUS_RANK: Record<string, number> = { working: 3, waiting: 2, open: 1 };

/** A machine can hold one ticket: a breakdown outranks support, which outranks a work request. */
function rank(ticket: Ticket): number {
  return (KIND_RANK[ticket.kind] ?? 0) * 10 + (STATUS_RANK[ticket.status] ?? 0);
}

function keepBest(map: Map<string, Ticket>, key: string, ticket: Ticket): void {
  const current = map.get(key);
  if (!current || rank(ticket) > rank(current)) map.set(key, ticket);
}

/** Join tickets to machines by id first, then by the raise-time machine code. */
function ticketFinder(open: Ticket[]): (machine: Machine) => Ticket | undefined {
  const byMachine = new Map<string, Ticket>();
  const byCode = new Map<string, Ticket>();
  for (const ticket of open) {
    if (ticket.machineId) keepBest(byMachine, ticket.machineId, ticket);
    const code = ticket.machineSnapshot?.code;
    if (code) keepBest(byCode, code, ticket);
  }
  return (machine) => byMachine.get(machine.id) ?? byCode.get(machine.code);
}

/** The machines the board shows: not in a hidden group, not in a segment kept off the board (Settings). */
function onBoard({ machines, segments, groups }: PlantConfig): Machine[] {
  const offBoard = new Set(segments.filter((s) => !s.show_on_board).map((s) => s.id));
  const hidden = new Set(groups.filter((group) => group.hidden).map((group) => group.id));
  return machines.filter((m) => !offBoard.has(m.segment_id ?? '') && !hidden.has(m.group_id ?? ''));
}

/** A breakdown stops its machine until the machine runs again. */
function stopOf(ticket: Ticket | undefined): Column | undefined {
  if (!ticket || ticket.kind !== 'stopped' || ticket.machineRunningAt) return undefined;
  return COLUMN_OF[ticket.status];
}

function bucketAges(stops: Stop[]): AgeBuckets {
  const ages = { underHour: 0, oneToFour: 0, fourToDay: 0, overDay: 0 };
  for (const { ageMin } of stops) {
    if (ageMin < 60) ages.underHour += 1;
    else if (ageMin < 240) ages.oneToFour += 1;
    else if (ageMin < 1440) ages.fourToDay += 1;
    else ages.overDay += 1;
  }
  return ages;
}

/** The live board: the pulse, the stopped machines by who owns the next step, and how old the stops are. */
export function liveBoard(config: PlantConfig, open: Ticket[], now: string): LiveBoard {
  const find = ticketFinder(open);
  const shown = onBoard(config);
  const columns: Record<Column, Stop[]> = { notStarted: [], repairing: [], waiting: [] };
  for (const machine of shown) {
    const ticket = find(machine);
    const column = stopOf(ticket);
    if (ticket && column) columns[column].push({ machine, ticket, ageMin: downNow(ticket, now) });
  }
  for (const column of COLUMNS) columns[column].sort((a, b) => b.ageMin - a.ageMin);
  const stops = COLUMNS.flatMap((column) => columns[column]);
  return {
    machines: shown.length,
    running: shown.length - stops.length,
    stopped: stops.length,
    columns,
    ages: bucketAges(stops),
  };
}
