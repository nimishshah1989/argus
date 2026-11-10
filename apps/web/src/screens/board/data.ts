import type { Group, Machine, Segment, Ticket } from '../../api.js';

export interface Tile {
  machine: Machine;
  ticket: Ticket | null;
}

export interface GroupSection {
  id: string;
  label: string | null;
  tiles: Tile[];
}

export interface SegmentSection {
  id: string;
  label: string;
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
  label: string,
  bucket: Map<string, Tile[]>,
  configured: Group[],
): SegmentSection {
  const labels = new Map(configured.map((group) => [group.id, group.name]));
  return {
    id,
    label,
    groups: groupKeys(
      bucket,
      configured.map((group) => group.id),
    ).map((key) => ({
      id: key,
      label: key === '' ? null : key === 'other' ? 'Other' : (labels.get(key) ?? 'Other'),
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

export function buildSections(
  machines: Machine[],
  segments: Segment[],
  groups: Group[],
  open: Ticket[],
): SegmentSection[] {
  const index = ticketIndex(open);
  const segmentIds = new Set(segments.map((segment) => segment.id));
  const segmentGroups = groupBySegment(groups);
  const buckets = new Map<string, Map<string, Tile[]>>();
  for (const machine of machines) {
    const segmentKey = segmentKeyFor(machine, segmentIds);
    const groupKey = groupFor(machine, segmentGroups.get(segmentKey) ?? []);
    addTile(buckets, segmentKey, groupKey, { machine, ticket: ticketFor(machine, index) });
  }
  const sections: SegmentSection[] = [];
  for (const segment of segments) {
    const bucket = buckets.get(segment.id);
    if (bucket) {
      sections.push(
        toSection(segment.id, segment.name, bucket, segmentGroups.get(segment.id) ?? []),
      );
    }
  }
  const other = buckets.get('');
  if (other) sections.push(toSection('other', 'Other', other, []));
  return sections;
}
