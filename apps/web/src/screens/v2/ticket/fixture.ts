import type { Config, Me, Ticket, TicketDetail } from '../../../api.js';
import type { TicketInput } from './model.js';

/**
 * Invented plant (no real people or machines): the wireframe's frame 2, a stopped VMC being worked by a lead and a
 * support technician. The gallery's `frozen` answer and every ticket test start here; a test changes one thing.
 */
export const NOW = '2026-11-24T06:00:00.000Z';
const at = (minutesAgo: number) => new Date(Date.parse(NOW) - minutesAgo * 60_000).toISOString();

export const CONFIG: Config = {
  features: {},
  language: 'en',
  timeZone: 'Asia/Kolkata',
  lists: {
    wait_reason: [
      {
        list: 'wait_reason',
        sort: 1,
        id: 'w1',
        code: 'spare',
        label: 'Spare part (vendor)',
        labelGu: null,
        labelHi: null,
        active: true,
        isVendor: true,
        pausesSla: true,
        tag: null,
      },
    ],
  },
  segments: [],
  groups: [],
  machines: [
    {
      id: 'm1',
      code: 'VC-17',
      category: 'VMC',
      cell: 'Cell 2',
      segment_id: null,
      group_id: null,
      criticality: 'A',
    },
  ],
  people: [
    { id: 'p1', name: 'Operator A', team: 'Production', title: 'Operator', active: true },
    { id: 'p2', name: 'Tech A', team: 'Maintenance', title: 'Technician', active: true },
    { id: 'p3', name: 'Tech B', team: 'Maintenance', title: 'Technician', active: true },
  ],
  shifts: [],
  severityMatrix: {
    default: {
      A: { stopped: 'S1', support: 'S2' },
      B: { stopped: 'S2', support: 'S3' },
      C: { stopped: 'S3', support: 'S4' },
    },
    workRequest: 'S4',
    urgentWorkRequest: 'S2',
  },
  i18nOverrides: {},
  slaPolicies: [],
  fp: 'fp',
};

export const TICKET: Ticket = {
  id: 't413',
  ref: 'TKT-0413',
  problem: 'Spindle noise',
  kind: 'stopped',
  status: 'working',
  machineId: 'm1',
  reportedByPersonId: 'p1',
  leadPersonId: 'p2',
  transferToPersonId: null,
  transferToShift: null,
  waitReason: null,
  assignedToPersonId: null,
  closedByPersonId: null,
  closeNote: null,
  taskReason: null,
  taskExpectedOn: null,
  location: 'Cell 2',
  workType: 'Repair',
  problemLang: null,
  reportedByRole: 'operator',
  parentId: null,
  waitingSpare: null,
  raisedLoginId: null,
  reportedAt: at(78),
  startedAt: at(65),
  segmentStartedAt: at(65),
  handoverSince: null,
  waitSince: null,
  machineRunningAt: null,
  machineStoppedAt: at(78),
  closedAt: null,
  kindUpgradedAt: null,
  expectedBackAt: null,
  selfStarted: false,
  handedOver: false,
  urgent: false,
  transfers: 0,
  lastEventSeq: 4,
  taskDownMin: null,
  closeKind: null,
  figures: {
    responseMin: 13,
    activeMin: 47,
    waitMin: 0,
    vendorMin: 0,
    handoverWaitMin: 0,
    downAccMin: 0,
    downtimeMin: null,
    followMin: 0,
    repairMin: 0,
    perPerson: { p2: 47, p3: 37 },
  },
  severity: 'S1',
  criticalitySnapshot: 'A',
  raisedChannel: 'web',
  machineSnapshot: { id: 'm1', code: 'VC-17', category: 'VMC', cell: 'Cell 2' },
  sla: null,
  handback: null,
  canAcknowledge: false,
};

const event = (seq: number, type: string, minutesAgo: number, actingPersonId: string) => ({
  seq,
  type,
  at: at(minutesAgo),
  text: null,
  reason: null,
  actingPersonId,
  loginId: null,
  isVendor: false,
  changes: null,
});

export const DETAIL: TicketDetail = {
  ticket: TICKET,
  events: [
    { ...event(1, 'down', 78, 'p1'), text: 'Spindle noise' },
    event(2, 'acknowledge', 76, 'p2'),
    event(3, 'start', 65, 'p2'),
    event(4, 'join', 55, 'p3'),
  ],
  people: [
    { personId: 'p2', role: 'primary', leftAt: null, leftReason: null },
    { personId: 'p3', role: 'support', leftAt: null, leftReason: null },
  ],
  tasks: [],
  taskSummary: { pending: 0, inProgress: 0, overdue: 0, done: 0, box: 'none' },
  parent: null,
  intervals: [
    { personId: 'p2', role: 'primary', startedAt: at(65), endedAt: null },
    { personId: 'p3', role: 'support', startedAt: at(55), endedAt: null },
  ],
  report: null,
  pmPlan: null,
};

/** A supervisor (Operator A is the reporter; the supervisor is a fourth person, so no crew rule applies to them). */
export const SUPERVISOR: Me = {
  id: 'u1',
  username: 'super',
  name: 'Supervisor A',
  title: 'Supervisor',
  role: 'supervisor',
  shared: false,
  actingPersonId: 'p9',
};

/** The model's input for the working frame; `patch` changes the ticket only. */
export function fixtureInput(
  patch: Partial<Ticket> = {},
  me: Me | undefined = SUPERVISOR,
): TicketInput {
  return {
    detail: { ...DETAIL, ticket: { ...TICKET, ...patch } },
    config: CONFIG,
    me,
    now: NOW,
    brand: 'Demo Plant',
  };
}
