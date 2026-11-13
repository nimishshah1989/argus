import {
  availableActions,
  type ActionCrewMember,
  type ActorContext,
  type Role,
  type TicketAction,
} from '@uptimo/domain';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { Me, Ticket, TicketPerson } from '../api.js';

/** Presentation only: which actions exist is decided by the domain `availableActions`. */
export interface ActionSpec {
  action: TicketAction;
  label: MessageKey;
  primary: boolean;
}

const ROLES: readonly string[] = [
  'operator',
  'technician',
  'supervisor',
  'head',
  'plant_head',
  'admin',
  'board',
] satisfies Role[];

const LABELS: Record<Exclude<TicketAction, 'cancel'>, MessageKey> = {
  start: 'action.label.start',
  resume: 'action.label.resume',
  update: 'action.label.update',
  pause: 'action.label.pause',
  transfer: 'action.label.transfer',
  'machine-running': 'action.label.machineRunning',
  'machine-stopped': 'action.label.machineStopped',
  join: 'action.label.join',
  leave: 'action.label.leave',
  close: 'action.label.close',
};

function labelFor(action: TicketAction, ticket: Ticket): MessageKey {
  if (action === 'cancel') return 'action.cancel';
  if (action === 'start' && ticket.handedOver) return 'action.label.pickUp';
  return LABELS[action];
}

/** The signed-in login as the domain's actor; an unknown role gives null (no actions). */
export function actorFrom(me: Me): ActorContext | null {
  if (!ROLES.includes(me.role)) return null;
  return {
    role: me.role as Role,
    loginId: me.id,
    personId: me.actingPersonId,
    shared: me.shared,
  };
}

/** Every primary or support crew row, left ones included (`close` reads them). */
export function crewFrom(people: TicketPerson[]): ActionCrewMember[] {
  return people.flatMap((member) =>
    member.role === 'primary' || member.role === 'support'
      ? [{ personId: member.personId, role: member.role, leftAt: member.leftAt }]
      : [],
  );
}

/** The actions the actor may take on the ticket now, labelled; the first one is primary. */
export function actionSpecs(
  ticket: Ticket,
  crew: ActionCrewMember[],
  actor: ActorContext,
): ActionSpec[] {
  return availableActions({ ...ticket, crew }, actor).map((action, index) => ({
    action,
    label: labelFor(action, ticket),
    primary: index === 0,
  }));
}

const QUICK: readonly TicketAction[] = ['start', 'resume', 'machine-running'];

/** The one field-free action a desk card offers; crew does not matter for it. */
export function quickSpec(ticket: Ticket, actor: ActorContext): ActionSpec | null {
  const offered = availableActions({ ...ticket, crew: [] }, actor);
  const action = QUICK.find(
    (candidate) =>
      offered.includes(candidate) && (candidate !== 'machine-running' || !ticket.machineRunningAt),
  );
  return action ? { action, label: labelFor(action, ticket), primary: false } : null;
}

/** Whether one action is on offer; used by the floor's own-ticket cancel. */
export function offers(ticket: Ticket, actor: ActorContext, action: TicketAction): boolean {
  return availableActions({ ...ticket, crew: [] }, actor).includes(action);
}
