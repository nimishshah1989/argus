import i18n from 'i18next';
import type { Config, Me, Ticket } from '../../../api.js';
import { openOnMachines, type FloorData } from '../../../faces/floor/use-floor.js';
import { reportModel, type ReportInput } from './adapter.js';
import type { ReportModel } from './model.js';

/**
 * An invented plant in the style of `e2e/gallery/floor-mock.ts` (fixed times), for the tests.
 * The tests read these values: change them only together with the tests.
 */
const item = (list: string, code: string, label: string, sort: number) => ({
  id: `${list}-${code}`,
  ...{ list, code, label, labelGu: null, labelHi: null, sort, active: true },
  ...{ isVendor: false, pausesSla: false, tag: null },
});
const machine = (id: string, code: string, group_id: string, cell: string) => ({
  ...{ id, code, category: 'Turning Center', cell, segment_id: null, group_id },
  criticality: 'B' as const,
});

const CONFIG = {
  lists: {
    quick_problem: [
      item('quick_problem', 'sp', 'Spindle alarm', 1),
      item('quick_problem', 'co', 'Coolant leak', 2),
      item('quick_problem', 'ha', 'Hydraulic pressure low', 3),
      { ...item('quick_problem', 'old', 'Old chip guard', 4), active: false },
    ],
    work_type: [
      item('work_type', 'pm', 'Preventive', 1),
      item('work_type', 'el', 'Electrical', 2),
      { ...item('work_type', 'gone', 'Retired type', 3), active: false },
    ],
    task_reason: [item('task_reason', 'part', 'Waiting for a part', 1)],
  },
  segments: [
    { id: 's2', code: 'UTIL', name: 'Utilities', sort: 2, show_on_board: true, group_by: 'group' },
    { id: 's1', code: 'TURN', name: 'Turning', sort: 1, show_on_board: true, group_by: 'group' },
    { id: 's3', code: 'EMPTY', name: 'Empty segment', sort: 3, show_on_board: true, group_by: '' },
  ],
  groups: [
    { id: 'g1', segment_id: 's1', code: 'CNC', name: 'CNC lathes', sort: 1, hidden: false },
    { id: 'g2', segment_id: 's1', code: 'DRL', name: 'Drills', sort: 2, hidden: false },
    { id: 'g3', segment_id: 's2', code: 'CMP', name: 'Compressors', sort: 1, hidden: false },
    { id: 'g4', segment_id: 's2', code: 'OLD', name: 'Old line', sort: 2, hidden: true },
    { id: 'g5', segment_id: 's3', code: 'NONE', name: 'No machines', sort: 1, hidden: false },
  ],
  machines: [
    machine('m1', 'CNC-01', 'g1', 'Cell 6'),
    machine('m2', 'CNC-02', 'g1', 'Cell 6'),
    machine('m3', 'CNC-03', 'g1', 'Cell 6'),
    machine('m4', 'DRL-04', 'g2', 'Cell 2'),
    machine('m5', 'CMP-01', 'g3', 'Utility'),
    machine('m6', 'OLD-09', 'g4', 'Utility'),
  ],
  people: [
    { id: 'p1', name: 'Omi', team: 'Production', title: 'Operator', active: true },
    { id: 'p2', name: 'Ravi', team: 'Maintenance', title: 'Technician', active: true },
  ],
} as unknown as Config;

/** A ticket with v1's reply fields the floor reads; the rest are left out on purpose. */
export function floorTicket(fields: Partial<Ticket> & { id: string }): Ticket {
  return {
    ...{ ref: `BD-${fields.id.toUpperCase()}`, kind: 'stopped', status: 'open', machineId: null },
    ...{ problem: 'Spindle stops under load', reportedByPersonId: 'p1', location: null },
    ...{ reportedAt: '2026-11-25T03:30:00.000Z', startedAt: null, closedAt: null },
    ...{ raisedChannel: 'floor', parentId: null, machineSnapshot: null, handback: null },
    ...{ taskReason: null, taskExpectedOn: null },
    ...fields,
  } as unknown as Ticket;
}

/** CNC-02 has a support ticket, DRL-04 a stopped one; CNC-01 a follow-up task; CMP-01 a PM job (not a breakdown). */
export const SUPPORT = floorTicket({
  id: 'a1',
  machineId: 'm2',
  kind: 'support',
  problem: 'Coolant low',
});
export const STOPPED = floorTicket({ id: 'a2', machineId: 'm4', problem: 'Chuck not clamping' });
export const TASK = floorTicket({
  ...{ id: 't7', ref: 'WR-7', kind: 'general', parentId: 'a0', raisedChannel: 'desk' },
  ...{ taskReason: 'part', taskExpectedOn: '2999-01-01' },
  machineSnapshot: { id: 'm1', code: 'CNC-01', category: null, cell: 'Cell 6' },
} as Partial<Ticket> & { id: string });
export const PM_JOB = floorTicket({
  ...{ id: 'c1', machineId: 'm5', kind: 'general', raisedChannel: 'pm' },
  problem: 'Monthly oil and filter check',
});
/** What a stopped report on CNC-01 comes back as. */
export const SENT = floorTicket({
  id: 'b9',
  ref: 'BD-0042',
  machineId: 'm1',
  problem: 'Spindle alarm',
});
/** A work request for a place, not a machine. */
export const WORK = floorTicket({
  ...{ id: 'w1', ref: 'WR-0043', kind: 'general', location: 'Cell 6' },
  problem: 'Install a wall fan',
});

const OPEN = [SUPPORT, STOPPED, TASK, PM_JOB];
const user = (role: string, personId: string, name: string, title: string) =>
  ({
    id: `u-${personId}`,
    username: name.toLowerCase(),
    name,
    title,
    role,
    shared: false,
    actingPersonId: personId,
  }) as Me;

/** Omi, an operator: no PM jobs tab, "Reporting as Omi (Operator)". */
export const FLOOR_OPERATOR: FloorData = {
  ...{ config: CONFIG, me: user('operator', 'p1', 'Omi', 'Operator') },
  ...{ open: openOnMachines(OPEN), openAll: OPEN, maintenance: false, who: 'Omi (Operator)' },
};
/** Ravi, a technician: the PM jobs tab and "I am starting work on it now". */
export const FLOOR_TECH: FloorData = {
  ...FLOOR_OPERATOR,
  me: user('technician', 'p2', 'Ravi', 'Technician'),
  maintenance: true,
  who: 'Ravi (Technician)',
};

/** Step 1 with nothing typed; recent holds an id the plant no longer has. */
export function reportInput(over: Partial<ReportInput> = {}): ReportInput {
  return {
    ...{ query: '', group: null, machine: null, kind: 'stopped', problem: '', startNow: false },
    ...{ sheet: null, sent: null, recent: ['m4', 'gone', 'm1', 'm2', 'm3'] },
    ...over,
  };
}

/** The gallery's frozen floor: Step 1 of `reportModel` for Ravi (maintenance) or Omi, in English. */
export function floorFixture(maintenance: boolean | undefined): ReportModel {
  return reportModel(maintenance ? FLOOR_TECH : FLOOR_OPERATOR, reportInput(), i18n.t.bind(i18n));
}
