import type { Config, Group, Machine, Segment, Ticket } from '../../api.js';

/** Spaces and dashes never matter when an operator types a machine (v3.reporting.01). */
export const norm = (value: string): string => value.toLowerCase().replace(/[\s-]/g, '');
const natural = (a: Machine, b: Machine) =>
  a.code.localeCompare(b.code, undefined, { numeric: true });

/** Machines whose code holds the query: exact first, then ends-with, then the rest; at most 30. */
export function searchMachines(machines: Machine[], query: string): Machine[] {
  const q = norm(query);
  if (!q) return [];
  const rank = (m: Machine) => {
    const code = norm(m.code);
    return code === q ? 0 : code.endsWith(q) ? 1 : 2;
  };
  return machines
    .filter((m) => norm(m.code).includes(q))
    .sort((a, b) => rank(a) - rank(b) || natural(a, b))
    .slice(0, 30);
}

/** The machine a `?m=` link names, by the same normalisation. */
export const machineByCode = (machines: Machine[], code: string): Machine | undefined =>
  machines.find((m) => norm(m.code) === norm(code));

/** Inside a group the number alone is enough: "30" finds VC-30. */
export function groupMachines(machines: Machine[], group: Group, query: string): Machine[] {
  const q = norm(query);
  const prefix = norm(group.code);
  return machines
    .filter((m) => m.group_id === group.id)
    .filter((m) => !q || norm(m.code).includes(q) || norm(m.code).replace(prefix, '').startsWith(q))
    .sort(natural);
}

export interface GroupCount {
  group: Group;
  count: number;
}
export interface SegmentSection {
  segment: Segment;
  count: number;
  groups: GroupCount[];
}

/** Segment sections with their visible groups and machine counts; empty groups and sections drop out. */
export function sections(
  config: Pick<Config, 'segments' | 'groups' | 'machines'>,
): SegmentSection[] {
  const counts = new Map<string, number>();
  for (const m of config.machines)
    if (m.group_id) counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
  return [...config.segments]
    .sort((a, b) => a.sort - b.sort)
    .map((segment) => {
      const groups = config.groups
        .filter((g) => g.segment_id === segment.id && !g.hidden && counts.has(g.id))
        .sort((a, b) => a.sort - b.sort)
        .map((group) => ({ group, count: counts.get(group.id)! }));
      return { segment, groups, count: groups.reduce((n, g) => n + g.count, 0) };
    })
    .filter((s) => s.groups.length > 0);
}

/** The middle machine's number, for the group's hint ("30 for VC-30"). */
export function groupExample(members: Machine[], group: Group): { num: string; code: string } {
  const code = members[Math.floor(members.length / 2)]?.code ?? group.code;
  const num = norm(code).startsWith(norm(group.code))
    ? code.slice(group.code.length).replace(/^[-\s]+/, '')
    : code;
  return { num, code };
}

export type RowStatus = 'running' | 'stopped' | 'support' | 'in_progress' | 'waiting';

/** What a machine row shows; until ticket 16's displayStatus lands this is the floor's own reading. */
export function rowStatus(ticket: Ticket | undefined): RowStatus {
  if (!ticket) return 'running';
  if (ticket.status === 'waiting') return 'waiting';
  if (ticket.status === 'working') return 'in_progress';
  return ticket.kind === 'support' ? 'support' : 'stopped';
}

/** The floor's words for a ticket's progress (decision 6). */
export function floorStatus(ticket: Ticket): 'booked' | 'in_progress' | 'fixed' {
  if (ticket.status === 'closed') return 'fixed';
  return ticket.status === 'open' ? 'booked' : 'in_progress';
}
