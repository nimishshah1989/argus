import type { RosterReply, RuleReply } from '@uptimo/shared/escalation-settings';
import type { AssetRegisterReply, ShiftReply } from '@uptimo/shared/plant-settings';
import type { PmPlanReply } from '@uptimo/shared/pm';

export const plan = (
  id: string,
  lastDoneOn: string | null,
  intervalDays: number | null,
  active = true,
): PmPlanReply => ({
  id,
  title: id,
  machineId: null,
  category: null,
  intervalDays,
  meterInterval: null,
  meterTolerance: null,
  lastMeterReading: null,
  lastDoneOn,
  checklist: [],
  active,
  createdAt: '2026-01-01T00:00:00.000Z',
});

export const register = (
  id: string,
  over: Partial<AssetRegisterReply> = {},
): AssetRegisterReply => ({
  id,
  kind: 'warranty',
  machineId: null,
  vendor: null,
  reference: null,
  startsOn: null,
  endsOn: null,
  dueOn: null,
  leadDays: 15,
  ownerPersonId: null,
  notes: null,
  active: true,
  ...over,
});

export const shift = (id: string, active = true): ShiftReply => ({
  id,
  code: id,
  name: id,
  startsAt: '06:00',
  endsAt: '14:00',
  crossesMidnight: false,
  active,
});

export const duty = (
  date: string,
  shiftId: string,
  level: RosterReply['level'] = 'L1',
  active = true,
): RosterReply => ({
  id: `${date}-${shiftId}-${level}`,
  date,
  shiftId,
  personId: 'p',
  level,
  active,
});

export const rule = (over: Partial<RuleReply>): RuleReply => ({
  id: `${over.level ?? 'L2'}-${over.delayMinutes ?? 0}-${over.trigger ?? 'ack_missed'}`,
  trigger: 'ack_missed',
  severityMin: 'S2',
  level: 'L2',
  notifyPersonId: null,
  notifyRole: 'supervisor',
  channel: 'push',
  delayMinutes: 15,
  repeatMinutes: null,
  repeatCap: null,
  active: true,
  ...over,
});
