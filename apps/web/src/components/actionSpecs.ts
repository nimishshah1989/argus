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
  action: ActionSlot;
  label: MessageKey;
  primary: boolean;
  /** Close only: the way of closing the form opens with (the bar's two close buttons). */
  preset?: 'report' | 'no_report' | 'done';
}

/** Acknowledge is a presentation-only slot: the domain's `availableActions` does not offer it. */
export type ActionSlot = TicketAction | 'acknowledge';

const ROLES: readonly string[] = [
  'operator',
  'technician',
  'supervisor',
  'head',
  'plant_head',
  'admin',
  'board',
] satisfies Role[];

const LABELS: Record<Exclude<ActionSlot, 'cancel'>, MessageKey> = {
  acknowledge: 'action.label.acknowledge',
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

function labelFor(action: ActionSlot, ticket: Ticket): MessageKey {
  if (action === 'cancel') return 'detail.action.cancel';
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

/** Bar order (design lock B3): the first slot offered is primary; the second close button sits near the end. */
type Slot = TicketAction | 'close-no-report';
const ORDER: readonly Slot[] = [
  'start',
  'resume',
  'close',
  'join',
  'pause',
  'transfer',
  'machine-running',
  'machine-stopped',
  'update',
  'leave',
  'close-no-report',
  'cancel',
];

/** A breakdown or support ticket closes with or without a report (two buttons); a work request is marked done. */
function specFor(
  slot: ActionSlot | 'close-no-report',
  ticket: Ticket,
): Omit<ActionSpec, 'primary'> {
  if (slot === 'acknowledge') return { action: slot, label: LABELS.acknowledge };
  if (slot === 'close-no-report') {
    return { action: 'close', label: 'detail.action.closeNoReport', preset: 'no_report' };
  }
  if (slot === 'close') {
    // A PM job closes on its plan's checklist, not with "Mark done" and a note (ticket 49c).
    if (ticket.raisedChannel === 'pm')
      return { action: 'close', label: 'pm.close.action', preset: 'report' };
    return ticket.kind === 'general'
      ? { action: 'close', label: 'closes.action.markDone', preset: 'done' }
      : { action: 'close', label: 'detail.action.closeReport', preset: 'report' };
  }
  return { action: slot, label: labelFor(slot, ticket) };
}

/** The actions the actor may take on the ticket now, labelled; the first one is primary (never Cancel). */
export function actionSpecs(
  ticket: Ticket,
  crew: ActionCrewMember[],
  actor: ActorContext,
): ActionSpec[] {
  const offered = availableActions({ ...ticket, crew }, actor);
  const slots: Array<ActionSlot | 'close-no-report'> = [
    // Acknowledge leads when the session may take it: it is what the clock is waiting for.
    ...(ticket.canAcknowledge && actor.personId !== null ? (['acknowledge'] as const) : []),
    ...ORDER.filter((slot) =>
      slot === 'close-no-report'
        ? offered.includes('close') && ticket.kind !== 'general'
        : offered.includes(slot),
    ),
  ];
  return slots.map((slot, index) => ({
    ...specFor(slot, ticket),
    primary: index === 0 && slot !== 'cancel',
  }));
}

const QUICK: readonly TicketAction[] = ['start', 'resume', 'machine-running'];
/** A flagged ticket's Start, Pick up and Resume confirm the lockout first, so the card sends it to the ticket. */
const NEEDS_STEPS: ReadonlySet<TicketAction> = new Set(['start', 'resume']);

/** The one field-free action a desk card offers; crew does not matter for it. */
export function quickSpec(ticket: Ticket, actor: ActorContext): ActionSpec | null {
  const offered = availableActions({ ...ticket, crew: [] }, actor);
  const action = QUICK.find(
    (candidate) =>
      offered.includes(candidate) &&
      !(ticket.lockout && NEEDS_STEPS.has(candidate)) &&
      (candidate !== 'machine-running' || !ticket.machineRunningAt),
  );
  return action ? { action, label: labelFor(action, ticket), primary: false } : null;
}

/** Whether one action is on offer; used by the floor's own-ticket cancel. */
export function offers(ticket: Ticket, actor: ActorContext, action: TicketAction): boolean {
  return availableActions({ ...ticket, crew: [] }, actor).includes(action);
}
