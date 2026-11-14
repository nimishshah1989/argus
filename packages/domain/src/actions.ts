import { canCancel, canClose, canWork } from './permissions.js';
import type { ActorContext, Kind, Status, TicketContext } from './types.js';

export type TicketAction =
  | 'start'
  | 'resume'
  | 'update'
  | 'pause'
  | 'transfer'
  | 'machine-running'
  | 'machine-stopped'
  | 'join'
  | 'leave'
  | 'close'
  | 'cancel';

/** The order buttons are shown in; the first one offered is the primary button. */
export const ACTION_ORDER: readonly TicketAction[] = [
  'start',
  'resume',
  'update',
  'pause',
  'transfer',
  'machine-running',
  'machine-stopped',
  'join',
  'leave',
  'close',
  'cancel',
];

type Time = Date | string | null;

export interface ActionCrewMember {
  personId: string;
  role: 'primary' | 'support';
  leftAt: Time;
}

export interface ActionTicket {
  status: Status;
  kind: Kind;
  handedOver: boolean;
  machineRunningAt: Time;
  /** Set when the machine stopped again after running; the pair says whether it is running now. */
  machineStoppedAt?: Time;
  startedAt: Time;
  raisedLoginId: string | null;
  leadPersonId: string | null;
  /** Set on a follow-up task, which may be closed straight from open. */
  parentId?: string | null;
  /** Every crew row, left ones included (`canClose` reads them). */
  crew: ActionCrewMember[];
}

interface Facts {
  ticket: ActionTicket;
  actor: ActorContext;
  context: TicketContext;
  crewed: boolean;
  leading: boolean;
}

const date = (time: Time): Date | null => (time === null ? null : new Date(time));
const live = ({ ticket }: Facts) => ['open', 'working', 'waiting'].includes(ticket.status);
const inPlay = ({ ticket }: Facts) => ['working', 'waiting'].includes(ticket.status);
const status = (wanted: Status) => (facts: Facts) => facts.ticket.status === wanted;

const runningNow = (ticket: ActionTicket) =>
  ticket.machineRunningAt !== null && !ticket.machineStoppedAt;
const canHandOver = ({ ticket, actor, leading }: Facts) =>
  leading &&
  ticket.crew.some((m) => m.role === 'primary' && !m.leftAt && m.personId !== actor.personId);

/** One predicate per action: the server's checks, minus the buttons the product keeps hidden. */
const RULES: Record<TicketAction, (facts: Facts) => boolean> = {
  start: status('open'),
  resume: status('waiting'),
  update: (facts) => inPlay(facts) || (facts.ticket.status === 'open' && facts.ticket.handedOver),
  pause: status('working'),
  transfer: status('working'),
  'machine-running': (facts) =>
    facts.ticket.kind === 'stopped' && inPlay(facts) && !runningNow(facts.ticket),
  'machine-stopped': (facts) => runningNow(facts.ticket) && inPlay(facts),
  join: (facts) => inPlay(facts) && !facts.crewed && !facts.leading,
  // the lead may leave only when a primary is there to take over (his rule); everyone else when on the crew
  leave: (facts) => (live(facts) && facts.crewed) || (inPlay(facts) && canHandOver(facts)),
  close: (facts) =>
    (facts.ticket.status === 'working' && canClose(facts.actor, facts.context)) ||
    // an open task is started by the person closing it, so they need only be allowed to work
    (facts.ticket.status === 'open' && facts.ticket.parentId != null),
  cancel: (facts) => live(facts) && canCancel(facts.actor, facts.context),
};

function factsFor(ticket: ActionTicket, actor: ActorContext): Facts {
  const crew = ticket.crew.map((member) => ({
    personId: member.personId,
    role: member.role,
    leftAt: date(member.leftAt) ?? undefined,
  }));
  const context: TicketContext = {
    raisedLoginId: ticket.raisedLoginId,
    leadPersonId: ticket.leadPersonId,
    startedAt: date(ticket.startedAt),
    status: ticket.status,
    crew,
  };
  return {
    ticket,
    actor,
    context,
    crewed: crew.some((member) => member.personId === actor.personId && !member.leftAt),
    leading: ticket.leadPersonId === actor.personId,
  };
}

/** The actions this actor may take now, in ACTION_ORDER. Pure; same rules as the handlers and route gate. */
export function availableActions(ticket: ActionTicket, actor: ActorContext): TicketAction[] {
  if (actor.personId === null) return [];
  const facts = factsFor(ticket, actor);
  const work = canWork(actor);
  return ACTION_ORDER.filter((action) => (work || action === 'cancel') && RULES[action](facts));
}
