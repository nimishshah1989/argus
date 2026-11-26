import type { GroupReply, MachineReply, ShiftReply } from '@uptimo/shared/plant-settings';

export const machine = (id: string, over: Partial<MachineReply> = {}): MachineReply => ({
  id,
  code: id.toUpperCase(),
  category: null,
  cell: null,
  area: null,
  location: null,
  segmentId: null,
  groupId: null,
  make: null,
  model: null,
  serial: null,
  year: null,
  status: 'active',
  criticality: 'B',
  excludedFromProduction: false,
  active: true,
  ...over,
});

export const group = (id: string, over: Partial<GroupReply> = {}): GroupReply => ({
  id,
  segmentId: 'seg',
  code: id.toUpperCase(),
  name: id,
  sort: 0,
  hidden: false,
  active: true,
  ...over,
});

export const shift = (
  code: string,
  startsAt: string,
  endsAt: string,
  active = true,
): ShiftReply => ({
  id: code,
  code,
  name: code,
  startsAt,
  endsAt,
  crossesMidnight: endsAt <= startsAt,
  active,
});
