export type Status = 'open' | 'working' | 'waiting' | 'closed' | 'cancelled';
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
  | 'upgrade_kind';

export interface TicketEvent {
  type: EventType;
  at: Date;
  reason?: string;
  isVendor?: boolean;
}

export interface WorkSegment {
  personId: string;
  role: 'lead' | 'primary' | 'support';
  startedAt: Date;
  endedAt?: Date;
}

export interface FigureOverrides {
  activeMin?: number;
  waitMin?: number;
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
}

export interface ActorContext {
  role: Role;
  loginId: string;
  personId: string | null;
  shared: boolean;
}

export interface CrewMember {
  personId: string;
  role: 'primary' | 'support';
  leftAt?: Date;
  leftReason?: string;
}

export interface TicketContext {
  raisedLoginId: string;
  leadPersonId: string | null;
  startedAt: Date | null;
  status: Status;
  crew: CrewMember[];
}
