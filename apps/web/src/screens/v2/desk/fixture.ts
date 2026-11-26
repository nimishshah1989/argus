import type { Config, Me, State, Ticket } from '../../../api.js';
import type { OpenInput } from './model.js';

/**
 * An invented plant at 11:30 in Kolkata on 25 Nov 2026 (the approved wireframe's desk): four machines stopped and not
 * started (LT-08 the longest, 2 h 39 min), one support request, one paused, one being worked on, two follow-up tasks,
 * two work requests (one urgent) and one job closed without a report. One machine has no open ticket.
 */
export const NOW = '2026-11-25T06:00:00.000Z';
const ago = (minutes: number): string => new Date(Date.parse(NOW) - minutes * 60_000).toISOString();

const MACHINES = [
  ['m1', 'LT-08'],
  ['m2', 'VC-17'],
  ['m3', 'VC-03'],
  ['m4', 'CNC-02'],
  ['m5', 'GRD-07'],
  ['m6', 'DRL-04'],
  ['m7', 'HMC-11'],
].map(([id, code]) => ({
  id: id!,
  code: code!,
  category: 'Machining',
  cell: 'Cell 1',
  segment_id: null,
  group_id: null,
  criticality: 'B' as const,
}));

export const CONFIG = {
  features: {},
  language: 'en',
  timeZone: 'Asia/Kolkata',
  lists: {
    task_reason: [{ code: 'spare', label: 'Waiting for spare', active: true }],
    wait_reason: [{ code: 'spare', label: 'Spare part', active: true }],
  },
  segments: [],
  groups: [],
  machines: MACHINES,
  people: [
    { id: 'p1', name: 'Tech A', team: 'Maintenance', title: 'Technician', active: true },
    { id: 'p2', name: 'Tech B', team: 'Maintenance', title: 'Technician', active: true },
    { id: 'p3', name: 'Operator A', team: 'Production', title: 'Operator', active: true },
  ],
  shifts: [],
  severityMatrix: {},
  i18nOverrides: {},
  slaPolicies: [],
  fp: 'fp',
} as unknown as Config;

const FIGURES = {
  responseMin: 12,
  activeMin: 30,
  waitMin: 45,
  vendorMin: 0,
  handoverWaitMin: 0,
  downAccMin: 0,
  downtimeMin: 0,
  followMin: 0,
  repairMin: 30,
  perPerson: {},
};

/** One `/state` ticket row with every field the reply carries; `fields` overrides. */
export function ticket(id: string, ref: string, fields: Partial<Ticket>): Ticket {
  return {
    id,
    ref,
    problem: 'Spindle noise',
    kind: 'stopped',
    status: 'open',
    machineId: null,
    reportedByPersonId: 'p3',
    leadPersonId: null,
    transferToPersonId: null,
    transferToShift: null,
    waitReason: null,
    assignedToPersonId: null,
    closedByPersonId: null,
    closeNote: null,
    taskReason: null,
    taskExpectedOn: null,
    location: null,
    workType: null,
    problemLang: null,
    reportedByRole: null,
    parentId: null,
    waitingSpare: null,
    raisedLoginId: null,
    reportedAt: ago(60),
    startedAt: null,
    segmentStartedAt: null,
    handoverSince: null,
    waitSince: null,
    machineRunningAt: null,
    machineStoppedAt: null,
    closedAt: null,
    kindUpgradedAt: null,
    expectedBackAt: null,
    selfStarted: false,
    handedOver: false,
    urgent: false,
    transfers: 0,
    lastEventSeq: 1,
    taskDownMin: null,
    closeKind: null,
    figures: null,
    severity: 'S2',
    criticalitySnapshot: 'B',
    raisedChannel: 'web',
    machineSnapshot: null,
    sla: null,
    handback: null,
    canAcknowledge: false,
    ...fields,
  } as Ticket;
}

const stopped = (id: string, ref: string, machineId: string, minutes: number) =>
  ticket(id, ref, { machineId, reportedAt: ago(minutes), machineStoppedAt: ago(minutes) });

export const OPEN: Ticket[] = [
  // Server order is not the screen's order: the screen sorts.
  stopped('t2', 'TKT-0413', 'm2', 2),
  { ...stopped('t1', 'TKT-0401', 'm1', 159), severity: 'S1' },
  stopped('t3', 'TKT-0409', 'm3', 19),
  ticket('t4', 'TKT-0398', { machineId: 'm4', kind: 'support', problem: 'Coolant low' }),
  ticket('t5', 'TKT-0390', {
    machineId: 'm5',
    status: 'waiting',
    leadPersonId: 'p2',
    startedAt: ago(120),
    waitSince: ago(45),
    waitReason: 'spare',
    machineStoppedAt: ago(150),
    reportedAt: ago(150),
    figures: FIGURES,
  }),
  ticket('t6', 'TKT-0395', {
    machineId: 'm6',
    status: 'working',
    leadPersonId: 'p1',
    startedAt: ago(144),
    machineStoppedAt: ago(170),
    reportedAt: ago(170),
    figures: { ...FIGURES, activeMin: 144, waitMin: 0 },
  }),
  ticket('t8', 'TKT-0386', {
    machineId: 'm1',
    kind: 'general',
    parentId: 'tp1',
    problem: 'Replace guard',
    taskReason: 'spare',
    taskExpectedOn: '2026-11-29',
    reportedByPersonId: 'p2',
  }),
  ticket('t7', 'TKT-0388', {
    machineId: 'm2',
    kind: 'general',
    parentId: 'tp2',
    problem: 'Replace spindle belt',
    taskReason: 'spare',
    taskExpectedOn: '2026-11-27',
    reportedByPersonId: 'p1',
  }),
  ticket('t9', 'TKT-0410', { kind: 'general', problem: 'Install a wall fan', reportedAt: ago(74) }),
  ticket('t10', 'TKT-0411', {
    kind: 'general',
    problem: 'Fix the store door',
    urgent: true,
    reportedAt: ago(20),
  }),
];

export const NEED_REPORT: Ticket[] = [
  ticket('t11', 'TKT-0380', {
    machineId: 'm1',
    status: 'closed',
    closeKind: 'no_report',
    leadPersonId: 'p2',
    closedByPersonId: 'p2',
    closedAt: ago(200),
    reportedAt: ago(300),
    figures: FIGURES,
  }),
];

export const STATE: State = { open: OPEN, needReport: NEED_REPORT, now: NOW };

/** A supervisor acting as Tech A on their own login. */
export const ME: Me = {
  id: 'u1',
  username: 'tech-a',
  name: 'Tech A',
  title: 'Supervisor',
  role: 'supervisor',
  shared: false,
  actingPersonId: 'p1',
} as Me;

/** The frozen Open screen input: no filter, Breakdowns segment. */
export const deskFixture: OpenInput = {
  state: STATE,
  config: CONFIG,
  me: ME,
  filter: '',
  segment: 'breakdowns',
};
