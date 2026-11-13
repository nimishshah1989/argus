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
  startedAt: Time;
  raisedLoginId: string | null;
  leadPersonId: string | null;
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

/** One predicate per action: the server's checks, minus the buttons the product keeps hidden. */
const RULES: Record<TicketAction, (facts: Facts) => boolean> = {
  start: status('open'),
  resume: status('waiting'),
  update: (facts) => inPlay(facts) || (facts.ticket.status === 'open' && facts.ticket.handedOver),
  pause: status('working'),
  transfer: status('working'),
  'machine-running': (facts) => facts.ticket.kind === 'stopped' && inPlay(facts),
  'machine-stopped': (facts) => facts.ticket.machineRunningAt !== null && inPlay(facts),
  join: (facts) => inPlay(facts) && !facts.crewed && !facts.leading,
  leave: (facts) => live(facts) && facts.crewed,
  close: (facts) => facts.ticket.status === 'working' && canClose(facts.actor, facts.context),
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
