import type { Criticality, Severity, SeverityMatrix } from '@uptimo/shared';
export type Status = 'open' | 'working' | 'waiting' | 'closed' | 'cancelled';
export type RestorableStatus = 'open' | 'working' | 'waiting';
export type Kind = 'stopped' | 'support' | 'general';
export type Role =
  'operator' | 'technician' | 'supervisor' | 'head' | 'plant_head' | 'admin' | 'board';

export type EventType =
  | 'down'
  | 'start'
  | 'pickup'
  | 'pause'
  | 'resume'
  | 'transfer'
  | 'update'
  | 'join'
  | 'leave'
  | 'running'
  | 'stopped'
  | 'close'
  | 'cancel'
  | 'restore'
  | 'edit'
  | 'report'
  | 'upgrade_kind'
  | 'lead'
  // tag_add / tag_remove: history only, nothing writes them any more (old events still render)
  | 'tag_add'
  | 'tag_remove'
  | 'acknowledge'
  | 'handback_confirm'
  | 'handback_dispute'
  | 'escalate'
  | 'escalation_ack'
  /** Written on a breakdown when a follow-up task is left from it or done; not something the machine did. */
  | 'task'
  | 'lockout_confirmed';

export interface EditChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface TicketEvent {
  type: EventType;
  /** Set on a history read: who acted (a lockout confirmation belongs to a person). */
  actingPersonId?: string | null;
  /** On a `lockout_confirmed` read back: the step codes that person confirmed. */
  stepCodes?: string[];
  at: Date;
  reason?: string;
  isVendor?: boolean;
  /** Historical SLA behavior of this pause; never read the mutable list flag for old events. */
  pausesSla?: boolean;
  /** The status a ticket had before a `cancel`; `restore` uses it to pick the resume status. */
  status?: RestorableStatus;
  /** Per-field old→new values recorded by a `correct` (`edit`) event. */
  changes?: EditChange[];
  /** On a `close`: production was asked to sign the fix off. */
  handbackRequested?: boolean;
  /** On an `escalation_ack`: the highest escalation level it covers. */
  escalationLevel?: string;
}

export interface WorkSegment {
  personId: string;
  role: 'lead' | 'primary' | 'support';
  startedAt: Date;
  endedAt?: Date;
}

export type OverridableFigure =
  'responseMin' | 'activeMin' | 'waitMin' | 'downtimeMin' | 'repairMin';

export interface FigureOverrides {
  handsOnOverrideMin?: number;
  waitingOverrideMin?: number;
  downtimeMin?: number;
  responseMin?: number;
  repairMin?: number;
}

export interface FigureInput {
  reportedAt: Date;
  kind: Kind;
  kindUpgradedAt?: Date;
  selfStarted: boolean;
  events: TicketEvent[];
  segments: WorkSegment[];
  overrides?: FigureOverrides;
  now: Date;
  closedAt?: Date;
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
  overridden?: OverridableFigure[];
}

export interface ActorContext {
  role: Role;
  loginId: string;
  personId: string | null;
  shared: boolean;
  /** A shared floor login's cell (its login row); only the breakdown PDF rule reads it. */
  cell?: string | null;
}

export interface CrewMember {
  personId: string;
  role: 'primary' | 'support';
  leftAt?: Date;
  leftReason?: string;
}

export interface TicketContext {
  raisedLoginId: string | null;
  leadPersonId: string | null;
  startedAt: Date | null;
  status: Status;
  crew: CrewMember[];
}

export type { Criticality, Severity, SeverityMatrix };
