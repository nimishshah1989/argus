import { useMemo } from 'react';
import type { Group, Machine, Segment } from '../../api.js';
import { Chip } from './Chip.js';

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s-]/g, '');
}

function filterMachines(
  machines: Machine[],
  search: string,
  segmentId: string,
  groupId: string,
): Machine[] {
  const query = normalize(search.trim());
  return machines.filter((machine) => {
    if (segmentId && machine.segment_id !== segmentId) return false;
    if (groupId && machine.group_id !== groupId) return false;
    if (query) {
      const haystack = normalize(`${machine.code} ${machine.cell ?? ''} ${machine.category ?? ''}`);
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

interface RowsProps {
  machines: Machine[];
  machineId: string;
  onMachine: (id: string) => void;
}

function MachineRows({ machines, machineId, onMachine }: RowsProps) {
  if (machines.length === 0) return <p className="text-neutral-500">No machines match.</p>;
  return (
    <ul className="grid gap-2">
      {machines.map((machine) => {
        const selected = machine.id === machineId;
        const tone = selected
          ? 'border-accent bg-accent text-white'
          : 'border-neutral-300 bg-white text-neutral-900';
        return (
          <li key={machine.id}>
            <button
              type="button"
              onClick={() => onMachine(machine.id)}
              aria-pressed={selected}
              className={`flex min-h-13 w-full items-center justify-between rounded-xl border px-4 text-base ${tone}`}
            >
              <span className="font-semibold">{machine.code}</span>
              <span className="text-sm opacity-70">{machine.cell ?? machine.category ?? ''}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface ChipsProps {
  segments: Segment[];
  groups: Group[];
  segmentId: string;
  groupId: string;
  onSegment: (id: string) => void;
  onGroup: (id: string) => void;
}

function PickerChips({ segments, groups, segmentId, groupId, onSegment, onGroup }: ChipsProps) {
  return (
    <>
      {segments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Chip active={!segmentId} onClick={() => onSegment('')}>
            All
          </Chip>
          {segments.map((segment) => (
            <Chip
              key={segment.id}
              active={segmentId === segment.id}
              onClick={() => onSegment(segment.id)}
            >
              {segment.name}
            </Chip>
          ))}
        </div>
      )}
      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <Chip key={group.id} active={groupId === group.id} onClick={() => onGroup(group.id)}>
              {group.name}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
}

interface Props {
  machines: Machine[];
  segments: Segment[];
  groups: Group[];
  search: string;
  onSearch: (value: string) => void;
  segmentId: string;
  onSegment: (id: string) => void;
  groupId: string;
  onGroup: (id: string) => void;
  machineId: string;
  onMachine: (id: string) => void;
}

export function MachinePicker({
  machines,
  segments,
  groups,
  search,
  onSearch,
  segmentId,
  onSegment,
  groupId,
  onGroup,
  machineId,
  onMachine,
}: Props) {
  const hasGroups = machines.some((machine) => machine.group_id != null);
  const segmentGroups = useMemo(
    () => groups.filter((group) => !segmentId || group.segment_id === segmentId),
    [groups, segmentId],
  );
  const visible = useMemo(
    () => filterMachines(machines, search, segmentId, groupId),
    [machines, search, segmentId, groupId],
  );

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-neutral-600">Which machine?</h2>
      <input
        type="search"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder="Search by code or cell"
        aria-label="Search machines"
        className="min-h-13 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base"
      />
      <PickerChips
        segments={segments}
        groups={hasGroups ? segmentGroups : []}
        segmentId={segmentId}
        groupId={groupId}
        onSegment={onSegment}
        onGroup={onGroup}
      />
      <MachineRows machines={visible} machineId={machineId} onMachine={onMachine} />
    </section>
  );
}
