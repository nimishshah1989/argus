import type { ActorContext, TicketContext } from '../types.js';

const WORK_ROLES = ['technician', 'supervisor', 'head', 'admin'] as const;

function isOwn(ctx: ActorContext, ticket: TicketContext): boolean {
  return ctx.loginId === ticket.raisedLoginId;
}

function isLeadOrPrimary(ctx: ActorContext, ticket: TicketContext): boolean {
  return Boolean(
    ctx.personId &&
    (ticket.leadPersonId === ctx.personId ||
      ticket.crew.some((member) => member.personId === ctx.personId && member.role === 'primary')),
  );
}

export function canRaise(ctx: ActorContext): boolean {
  return ctx.role !== 'board';
}

export function canCancel(ctx: ActorContext, ticket: TicketContext): boolean {
  if (ctx.role === 'operator') return isOwn(ctx, ticket) && !ticket.startedAt;
  if (
    ctx.role === 'technician' ||
    ctx.role === 'supervisor' ||
    ctx.role === 'head' ||
    ctx.role === 'admin'
  ) {
    return ticket.status !== 'closed' && ticket.status !== 'cancelled';
  }
  return false;
}

export function canWork(ctx: ActorContext): boolean {
  return (WORK_ROLES as readonly string[]).includes(ctx.role);
}

export function canClose(ctx: ActorContext, ticket: TicketContext): boolean {
  if (ctx.role === 'supervisor' || ctx.role === 'head' || ctx.role === 'admin') return true;
  if (ctx.role === 'technician') return ctx.shared || isLeadOrPrimary(ctx, ticket);
  return false;
}

export function canLateReport(ctx: ActorContext): boolean {
  return (WORK_ROLES as readonly string[]).includes(ctx.role);
}

/** Roles that can sit on a duty roster line or be given a ticket (DOMAIN §3: technician L1 up to plant head L4). */
const ACKNOWLEDGE_ROLES: readonly string[] = ['technician', 'supervisor', 'head', 'plant_head'];

/**
 * Who may acknowledge a ticket (DOMAIN §2: "assignee or any on-duty technician"): the person it is assigned to, or
 * a person on the duty roster for the shift now running. Nobody else, an admin included (an admin can still start the
 * ticket, which stops the clock too). A shared login with no acting person has nobody to look up, so it never passes.
 * The roster side is the caller's answer for the acting person (vendor-level lines do not count).
 */
export function canAcknowledge(
  ctx: ActorContext,
  facts: { onRoster: boolean; assignedToActor: boolean },
): boolean {
  if (ctx.personId === null || !ACKNOWLEDGE_ROLES.includes(ctx.role)) return false;
  return facts.onRoster || facts.assignedToActor;
}

export function canRestore(ctx: ActorContext): boolean {
  return ctx.role === 'admin';
}

export function canCorrect(ctx: ActorContext): boolean {
  return ctx.role === 'admin';
}

/** An allow-list: a role added later gets no breakdown PDF until it is named here. */
const BREAKDOWN_PDF_ROLES: readonly string[] = [
  'technician',
  'supervisor',
  'head',
  'plant_head',
  'admin',
];

/**
 * Who may print a breakdown PDF (DOMAIN §3). An operator gets the breakdowns they reported; a shared floor login
 * also gets every breakdown on a machine in its own cell; maintenance, supervisors, heads and admins get all; the
 * board gets none.
 */
export function canBreakdownPdf(
  ctx: ActorContext,
  ticket: { raisedLoginId: string | null; cell: string | null },
): boolean {
  if (ctx.role === 'operator') {
    if (isOwn(ctx, { raisedLoginId: ticket.raisedLoginId } as TicketContext)) return true;
    return ctx.shared && ctx.cell != null && ctx.cell === ticket.cell;
  }
  return BREAKDOWN_PDF_ROLES.includes(ctx.role);
}

const HANDBACK_ROLES = ['supervisor', 'head', 'plant_head', 'admin'] as const;

/** Technicians and the board never answer a sign-off (DOMAIN §3); this is the check that needs no ticket. */
export function canAnswerHandbackAtAll(role: string): boolean {
  return role === 'operator' || (HANDBACK_ROLES as readonly string[]).includes(role);
}

/**
 * DOMAIN §3: an operator answers for a ticket their login raised, one they reported themselves, or one on a machine
 * in their login's cell (`sameCell`, decided where the cells are known); supervisors and above answer any.
 */
export function canAnswerHandback(
  ctx: ActorContext,
  ticket: { raisedLoginId: string | null; reportedByPersonId: string | null },
  sameCell: boolean,
): boolean {
  if ((HANDBACK_ROLES as readonly string[]).includes(ctx.role)) return true;
  if (ctx.role !== 'operator') return false;
  const reporter = ctx.personId !== null && ctx.personId === ticket.reportedByPersonId;
  return ctx.loginId === ticket.raisedLoginId || reporter || sameCell;
}
