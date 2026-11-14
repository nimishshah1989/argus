import type { Group, Machine, Segment, Ticket } from '../../api.js';

export interface Tile {
  machine: Machine;
  ticket: Ticket | null;
}

export interface GroupSection {
  id: string;
  label: string | null;
  /** The catch-all group; the screen names it with `board.other`. */
  other: boolean;
  tiles: Tile[];
}

export interface SegmentSection {
  id: string;
  label: string | null;
  /** The catch-all section; the screen names it with `board.other`. */
  other: boolean;
  groups: GroupSection[];
}

export interface BoardCounts {
  total: number;
  stopped: number;
  waiting: number;
  support: number;
  workRequests: number;
}

export type TileStatus = 'idle' | 'open' | 'working' | 'waiting';

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
export function ticketIndex(open: Ticket[]): {
  byMachine: Map<string, Ticket>;
  byCode: Map<string, Ticket>;
} {
  const byMachine = new Map<string, Ticket>();
  const byCode = new Map<string, Ticket>();
  for (const ticket of open) {
    if (ticket.machineId) keepBest(byMachine, ticket.machineId, ticket);
    const code = ticket.machineSnapshot?.code;
    if (code) keepBest(byCode, code, ticket);
  }
  return { byMachine, byCode };
}

export function boardCounts(open: Ticket[]): BoardCounts {
  const counts: BoardCounts = {
    total: open.length,
    stopped: 0,
    waiting: 0,
    support: 0,
    workRequests: 0,
  };
  for (const ticket of open) {
    if (ticket.kind === 'stopped') counts.stopped += 1;
    else if (ticket.kind === 'support') counts.support += 1;
    else counts.workRequests += 1;
    if (ticket.status === 'waiting') counts.waiting += 1;
  }
  return counts;
}

export function tileStatus(ticket: Ticket | null): TileStatus {
  if (!ticket) return 'idle';
  if (ticket.status === 'working' || ticket.status === 'waiting') return ticket.status;
  return 'open';
}

function groupKeys(bucket: Map<string, Tile[]>, configured: string[]): string[] {
  const keys = configured.filter((key) => bucket.has(key));
  if (bucket.has('other')) keys.push('other');
  if (bucket.has('')) keys.push('');
  return keys;
}

function toSection(
  id: string,
  label: string | null,
  bucket: Map<string, Tile[]>,
  configured: Group[],
): SegmentSection {
  const labels = new Map(configured.map((group) => [group.id, group.name]));
  return {
    id,
    label,
    other: label === null,
    groups: groupKeys(
      bucket,
      configured.map((group) => group.id),
    ).map((key) => ({
      id: key,
      label: key === '' || key === 'other' ? null : (labels.get(key) ?? null),
      other: key === 'other',
      tiles: bucket.get(key) ?? [],
    })),
  };
}

function groupFor(machine: Machine, configured: Group[]): string {
  if (configured.length === 0) return '';
  const groupId = machine.group_id;
  return groupId && configured.some((group) => group.id === groupId) ? groupId : 'other';
}

function segmentKeyFor(machine: Machine, segmentIds: Set<string>): string {
  return machine.segment_id && segmentIds.has(machine.segment_id) ? machine.segment_id : '';
}

function ticketFor(
  machine: Machine,
  index: { byMachine: Map<string, Ticket>; byCode: Map<string, Ticket> },
): Ticket | null {
  return index.byMachine.get(machine.id) ?? index.byCode.get(machine.code) ?? null;
}

function addTile(
  buckets: Map<string, Map<string, Tile[]>>,
  segmentKey: string,
  groupKey: string,
  tile: Tile,
): void {
  const bucket = buckets.get(segmentKey) ?? new Map<string, Tile[]>();
  const tiles = bucket.get(groupKey) ?? [];
  tiles.push(tile);
  bucket.set(groupKey, tiles);
  buckets.set(segmentKey, bucket);
}

function groupBySegment(groups: Group[]): Map<string, Group[]> {
  const bySegment = new Map<string, Group[]>();
  for (const group of groups) {
    bySegment.set(group.segment_id, [...(bySegment.get(group.segment_id) ?? []), group]);
  }
  return bySegment;
}

/** The machines the board shows: not in a hidden group, not in a segment kept off the board (Settings). */
function onBoard(machines: Machine[], segments: Segment[], groups: Group[]): Machine[] {
  const offBoard = new Set(segments.filter((s) => !s.show_on_board).map((s) => s.id));
  const hidden = new Set(groups.filter((group) => group.hidden).map((group) => group.id));
  return machines.filter((m) => !offBoard.has(m.segment_id ?? '') && !hidden.has(m.group_id ?? ''));
}

/** The open tickets the board counts: every ticket except those on a machine the board leaves out. */
export function ticketsOnBoard(
  open: Ticket[],
  config: { machines: Machine[]; segments: Segment[]; groups: Group[] },
): Ticket[] {
  const shown = new Set(onBoard(config.machines, config.segments, config.groups).map((m) => m.id));
  const left = new Set(config.machines.map((m) => m.id).filter((id) => !shown.has(id)));
  return open.filter((ticket) => !ticket.machineId || !left.has(ticket.machineId));
}

export function buildSections(
  machines: Machine[],
  segments: Segment[],
  groups: Group[],
  open: Ticket[],
): SegmentSection[] {
  const index = ticketIndex(open);
  const shown = segments.filter((segment) => segment.show_on_board);
  const segmentIds = new Set(shown.map((segment) => segment.id));
  const segmentGroups = groupBySegment(groups.filter((group) => !group.hidden));
  const buckets = new Map<string, Map<string, Tile[]>>();
  for (const machine of onBoard(machines, segments, groups)) {
    const segmentKey = segmentKeyFor(machine, segmentIds);
    const groupKey = groupFor(machine, segmentGroups.get(segmentKey) ?? []);
    addTile(buckets, segmentKey, groupKey, { machine, ticket: ticketFor(machine, index) });
  }
  const sections: SegmentSection[] = [];
  for (const segment of shown) {
    const bucket = buckets.get(segment.id);
    if (bucket) {
      sections.push(
        toSection(segment.id, segment.name, bucket, segmentGroups.get(segment.id) ?? []),
      );
    }
  }
  const other = buckets.get('');
  if (other) sections.push(toSection('other', null, other, []));
  return sections;
}
