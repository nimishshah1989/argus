import type { Config, Me, State, Ticket } from '../../../api.js';
import type { MineInput, TeamInput, WindowRead } from './team-model.js';

/**
 * An invented plant at 11:30 in Kolkata on 25 Nov 2026 (the approved wireframe's Mine and Team frames).
 * Working: Tech A on LT-08 for 2 h 24 min (the single longest job) and Tech B on two jobs, 2 h 30 min in all, so
 * Tech B heads "Working now" while Tech A is on the longest job. Two paused jobs, sent newest first. One job not
 * started, one work request. Cancelled: one inside 24 h, one outside. Closed: three inside 30 days over two months
 * (one with a per-person split), one outside.
 */
export const NOW = '2026-11-25T06:00:00.000Z';
export const ago = (minutes: number): string =>
  new Date(Date.parse(NOW) - minutes * 60_000).toISOString();

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
  lists: { wait_reason: [{ code: 'spare', label: 'Spare part', active: true }] },
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
  waitMin: 0,
  vendorMin: 0,
  handoverWaitMin: 0,
  downAccMin: 0,
  downtimeMin: 0,
  followMin: 0,
  repairMin: 30,
  perPerson: {},
};

/** One ticket row with every field the reply carries; `fields` overrides. */
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

/** `[id, ref]` of a row. */
type Key = [id: string, ref: string];

const working = ([id, ref]: Key, machineId: string, lead: string, activeMin: number) =>
  ticket(id, ref, {
    machineId,
    status: 'working',
    leadPersonId: lead,
    reportedAt: ago(activeMin + 20),
    machineStoppedAt: ago(activeMin + 20),
    startedAt: ago(activeMin),
    figures: { ...FIGURES, activeMin },
  });

const paused = ([id, ref]: Key, machineId: string, waitMin: number, waitReason: string) =>
  ticket(id, ref, {
    machineId,
    status: 'waiting',
    leadPersonId: 'p2',
    reportedAt: ago(waitMin + 60),
    startedAt: ago(waitMin + 30),
    waitSince: ago(waitMin),
    waitReason,
    figures: { ...FIGURES, waitMin },
  });

const closed = (
  [id, ref]: Key,
  machineId: string,
  closedAt: string,
  fields: Partial<Ticket> = {},
) =>
  ticket(id, ref, {
    machineId,
    status: 'closed',
    leadPersonId: 'p1',
    reportedAt: new Date(Date.parse(closedAt) - 180 * 60_000).toISOString(),
    closedAt,
    figures: FIGURES,
    ...fields,
  });

/** `/state` open rows, in server order (newest first): the screen sorts. */
export const LIVE: Ticket[] = [
  ticket('t7', 'TKT-0415', {
    kind: 'general',
    workType: 'Civil',
    problem: 'Fix the store door',
    reportedAt: ago(5),
  }),
  ticket('t5', 'TKT-0413', { machineId: 'm7', machineStoppedAt: ago(20), reportedAt: ago(20) }),
  working(['t6', 'TKT-0414'], 'm4', 'p2', 120),
  paused(['t3', 'TKT-0390'], 'm5', 45, 'spare'),
  paused(['t4', 'TKT-0395'], 'm2', 90, 'vendor_visit'),
  working(['t2', 'TKT-0412'], 'm3', 'p2', 30),
  working(['t1', 'TKT-0409'], 'm1', 'p1', 144),
];

export const STATE: State = { open: LIVE, needReport: [], now: NOW };

/** The cancelled window as read (server order newest first): one inside 24 h, one 30 h ago. */
export const CANCELLED: WindowRead = {
  items: [
    ticket('t20', 'TKT-0370', {
      machineId: 'm6',
      status: 'cancelled',
      cancelledAt: ago(180),
    } as Partial<Ticket>),
    ticket('t21', 'TKT-0350', {
      machineId: 'm3',
      status: 'cancelled',
      cancelledAt: ago(30 * 60),
    } as Partial<Ticket>),
  ],
  loading: false,
  error: null,
};

/**
 * The closed window as read. November: TKT-0380 (Tech B lead, 1 h 0 min) and TKT-0381 (Tech A, 45 min).
 * October: TKT-0360 split 90 min Tech A (lead, primary) and 30 min Tech B (support). TKT-0340 is 40 days old.
 */
export const CLOSED: WindowRead = {
  items: [
    closed(['t30', 'TKT-0380'], 'm1', ago(200), {
      leadPersonId: 'p2',
      figures: { ...FIGURES, activeMin: 60 },
    }),
    closed(['t33', 'TKT-0381'], 'm6', ago(500), { figures: { ...FIGURES, activeMin: 45 } }),
    closed(['t31', 'TKT-0360'], 'm3', '2026-10-30T10:00:00.000Z', {
      figures: { ...FIGURES, activeMin: 120, perPerson: { p1: 90, p2: 30 } },
    }),
    closed(['t32', 'TKT-0340'], 'm2', ago(40 * 24 * 60), {
      figures: { ...FIGURES, activeMin: 50 },
    }),
  ],
  loading: false,
  error: null,
};

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

/** Tech A's Mine window as read: one working, one paused, two closed inside 30 days, one older. */
export const MINE: WindowRead = {
  items: [
    working(['t1', 'TKT-0409'], 'm1', 'p1', 144),
    ticket('t8', 'TKT-0392', {
      machineId: 'm5',
      status: 'waiting',
      leadPersonId: 'p1',
      reportedAt: ago(200),
      startedAt: ago(150),
      waitSince: ago(60),
      waitReason: 'spare',
      figures: { ...FIGURES, waitMin: 60 },
    }),
    closed(['t33', 'TKT-0381'], 'm6', ago(500), { figures: { ...FIGURES, activeMin: 45 } }),
    closed(['t31', 'TKT-0360'], 'm3', '2026-10-30T10:00:00.000Z'),
    closed(['t32', 'TKT-0340'], 'm2', ago(40 * 24 * 60)),
  ],
  loading: false,
  error: null,
};

export const mineFixture: MineInput = { mine: MINE, me: ME, config: CONFIG, now: NOW };

export const teamFixture: TeamInput = {
  state: STATE,
  // Tech A joined Tech B's TKT-0414 as support; the leads are the tickets' own.
  crew: [{ ticketId: 't6', personId: 'p1', role: 'support', joinedAt: ago(60) }],
  config: CONFIG,
  cancelled: CANCELLED,
  closed: CLOSED,
  now: NOW,
};
