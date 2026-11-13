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

export function canRestore(ctx: ActorContext): boolean {
  return ctx.role === 'admin';
}

export function canCorrect(ctx: ActorContext): boolean {
  return ctx.role === 'admin';
}
