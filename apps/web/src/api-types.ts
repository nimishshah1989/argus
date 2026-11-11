import type { BreakdownReportBody } from '../../../packages/shared/src/ticket.js';

/** The DTOs the web client exchanges with the API; `api.ts` re-exports every one of them. */

export type RaiseKind = 'stopped' | 'support' | 'general';

export type TicketStatus = 'open' | 'working' | 'waiting' | 'closed' | 'cancelled';

export type CommandAction =
  | 'start'
  | 'join'
  | 'leave'
  | 'pause'
  | 'resume'
  | 'transfer'
  | 'update'
  | 'machine-running'
  | 'machine-stopped'
  | 'close'
  | 'report'
  | 'cancel'
  | 'restore'
  | 'correct'
  | 'upgrade-kind';

export interface Machine {
  id: string;
  code: string;
  category: string | null;
  cell: string | null;
  segment_id: string | null;
  group_id: string | null;
  criticality: string | null;
}

export interface Segment {
  id: string;
  code: string;
  name: string;
}

export interface Group {
  id: string;
  segment_id: string;
  code: string;
  name: string;
}

export interface ListItem {
  id: string;
  code: string;
  label: string;
  active: boolean;
}

export interface Person {
  id: string;
  name: string;
  team: string;
  title: string | null;
  active: boolean;
  phone: string | null;
}

export interface Shift {
  id: string;
  code: string;
  name: string;
  starts_at: string;
  ends_at: string;
  crosses_midnight: boolean;
}

export interface Config {
  features: Record<string, boolean>;
  language: string;
  timeZone: string;
  lists: Record<string, ListItem[]>;
  segments: Segment[];
  groups: Group[];
  machines: Machine[];
  people: Person[];
  shifts: Shift[];
}

export interface Figures {
  responseMin: number | null;
  activeMin: number;
  waitMin: number;
  vendorMin: number;
  handoverWaitMin: number;
  downAccMin: number;
  downtimeMin: number | null;
  followMin: number | null;
  repairMin: number;
  perPerson: Record<string, number>;
}

export type CloseKind = 'report' | 'no_report' | 'done';

export type BreakdownCategory = 'E' | 'M' | 'E/M' | 'PM';

export type { BreakdownReportBody };

/** The stored report on ticket detail (server `StoredReport` in ticket-report.ts). */
export interface BreakdownReport {
  id: string;
  ticketId: string | null;
  machineId: string;
  date: string;
  shiftCode: string;
  problem: string;
  observedBy: string | null;
  correctiveAction: string | null;
  downtimeMin: number;
  responseMin: number | null;
  repairMin: number | null;
  breakdownCategory: string | null;
  maintCode: string | null;
  spareUsed: string | null;
  rootCause: string | null;
  handoverName: string | null;
  people: { personId: string; role: 'done' | 'supported' }[];
}

export interface Ticket {
  id: string;
  ref: string;
  kind: RaiseKind;
  status: TicketStatus;
  machineId: string | null;
  machineSnapshot: { code?: string | null; category?: string | null; cell?: string | null } | null;
  problem: string;
  reportedAt: string;
  reportedByPersonId: string | null;
  location: string | null;
  workType: string | null;
  urgent: boolean;
  handedOver: boolean;
  startedAt: string | null;
  leadPersonId: string | null;
  waitReason: string | null;
  machineRunningAt: string | null;
  closedAt: string | null;
  closeKind: CloseKind | null;
  closeNote: string | null;
  figures: Figures | null;
}

export interface State {
  open: Ticket[];
  needReport: Ticket[];
  now: string;
}

export interface TicketEvent {
  seq: number;
  type: string;
  at: string;
  text: string | null;
  reason: string | null;
  isVendor: boolean;
  actingPersonId: string | null;
  loginId: string | null;
}

export interface TicketPerson {
  personId: string;
  role: string;
  leftAt: string | null;
  leftReason: string | null;
}

export interface TicketInterval {
  personId: string;
  role: string;
  startedAt: string;
  endedAt: string | null;
}
export interface TicketDetail {
  ticket: Ticket;
  events: TicketEvent[];
  people: TicketPerson[];
  tasks: unknown[];
  intervals: TicketInterval[];
  report: BreakdownReport | null;
}
export interface Me {
  id: string;
  username: string;
  name: string;
  title: string | null;
  role: string;
  shared: boolean;
  actingPersonId: string;
}

export type CorrectChanges = Partial<
  Pick<Ticket, 'reportedAt' | 'startedAt' | 'closedAt' | 'problem' | 'leadPersonId'>
> & { machineId?: string | null; kind?: RaiseKind; closedByPersonId?: string | null };
export interface RaiseTicketBody {
  kind: RaiseKind;
  machineId?: string;
  location?: string;
  workType?: string;
  urgent?: boolean;
  problem: string;
}

export interface TicketListQuery {
  status?: TicketStatus[];
  kind?: RaiseKind[];
  machineId?: string;
  personId?: string;
  raisedBy?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface TicketPage {
  items: Ticket[];
  nextCursor: string | null;
}

/** The action bodies the desk sends; each command from DOMAIN.md §4. */
export type CommandBody =
  | { personId: string }
  | { personId: string; reasonCode: string; note?: string }
  | { personId: string; text: string }
  | { personId: string; note: string; toPersonId?: string }
  | { personId: string; kind: CloseKind; note?: string; report?: BreakdownReportBody }
  | { personId: string; report: BreakdownReportBody }
  | { personId: string; reason: string }
  | { personId: string; role: 'primary' | 'support' }
  | { reason: string; changes: CorrectChanges };

export type CommandResult = { ticket: Ticket } | { queued: true; id: string };
