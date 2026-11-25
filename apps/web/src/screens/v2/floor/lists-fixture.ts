import type { Handback } from '../../../components/signoff.js';
import type { Machine, Me, Ticket } from '../../../api.js';

/*
 * Invented rows for the floor-lists tests. Not a gallery fixture: the `floor` screen's `fixture.ts`/`register.ts` are
 * #767's; this file's name keeps it out of `data.test.ts`'s "fixture.ts needs register.ts" rule.
 */

/** An invented plant's machine. */
export const listMachine = (id: string, code: string): Machine => ({
  id,
  code,
  category: 'VMC',
  cell: 'Cell 2',
  segment_id: null,
  group_id: null,
  criticality: null,
});

/** An invented login; `operator-a` raised every listed ticket on login `login-1` as person `person-1`. */
export const listMe = (over: Partial<Me> = {}): Me => ({
  id: 'login-1',
  username: 'operator-a',
  name: 'Operator A',
  title: 'Operator',
  role: 'operator',
  shared: false,
  actingPersonId: 'person-1',
  ...over,
});

/** A sign-off as the server sends it; asked at 10:31, due 4 h later. */
export const listHandback = (over: Partial<Handback> = {}): Handback => ({
  status: 'requested',
  requestedAt: '2026-11-13T10:31:00.000Z',
  dueAt: '2026-11-13T14:31:00.000Z',
  respondedAt: null,
  respondedByPersonId: null,
  disputeReason: null,
  reopenCount: 0,
  turnaround: { maintenanceMin: 72, productionMin: 22 },
  ...over,
});

/** A Booked breakdown on VC-17 raised by `listMe()`; override what a case needs. */
export const listTicket = (over: Partial<Ticket> = {}): Ticket => ({
  id: 'ticket-1',
  ref: 'BD-0149',
  kind: 'stopped',
  status: 'open',
  machineId: 'machine-1',
  machineSnapshot: { code: 'VC-17', category: 'VMC', cell: 'Cell 2' },
  problem: 'Spindle alarm',
  reportedAt: '2026-11-13T09:00:00.000Z',
  reportedByPersonId: 'person-1',
  raisedLoginId: 'login-1',
  location: null,
  workType: null,
  urgent: false,
  handedOver: false,
  startedAt: null,
  leadPersonId: null,
  waitReason: null,
  machineRunningAt: null,
  closedAt: null,
  closeKind: null,
  closeNote: null,
  severity: null,
  criticalitySnapshot: null,
  selfStarted: false,
  segmentStartedAt: null,
  handoverSince: null,
  transferToPersonId: null,
  transferToShift: null,
  transfers: 0,
  waitSince: null,
  assignedToPersonId: null,
  machineStoppedAt: null,
  closedByPersonId: null,
  taskReason: null,
  taskExpectedOn: null,
  taskDownMin: null,
  kindUpgradedAt: null,
  lastEventSeq: 0,
  problemLang: null,
  reportedByRole: null,
  raisedChannel: 'floor',
  parentId: null,
  expectedBackAt: null,
  waitingSpare: null,
  sla: null,
  handback: null,
  canAcknowledge: false,
  figures: null,
  ...over,
});
