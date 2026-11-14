import type { ActorContext } from '../types.js';

export function canDayReport(ctx: ActorContext): boolean {
  if (ctx.role === 'technician') return true; // own only is enforced by the query, not this gate
  if (
    ctx.role === 'supervisor' ||
    ctx.role === 'head' ||
    ctx.role === 'plant_head' ||
    ctx.role === 'admin'
  )
    return true;
  return false;
}

/** The team day report (DOMAIN §3): the plant head's view, and an option for supervisors, heads and admins. */
export function canTeamDayReport(ctx: ActorContext): boolean {
  return (
    ctx.role === 'supervisor' ||
    ctx.role === 'head' ||
    ctx.role === 'plant_head' ||
    ctx.role === 'admin'
  );
}

export function canLiveBoard(ctx: ActorContext, floorLive: boolean): boolean {
  return ctx.role === 'operator' ? floorLive : true;
}

export function canMoney(ctx: ActorContext): boolean {
  return ctx.role === 'head' || ctx.role === 'plant_head' || ctx.role === 'admin';
}

export function canAnalytics(ctx: ActorContext): boolean {
  return (
    ctx.role === 'supervisor' ||
    ctx.role === 'head' ||
    ctx.role === 'plant_head' ||
    ctx.role === 'admin'
  );
}

/** Who sees every login's closed-without-report tickets; everyone else sees their own (DOMAIN §3). */
export function seesAllNeedReport(ctx: Pick<ActorContext, 'role'>): boolean {
  return ctx.role === 'supervisor' || ctx.role === 'head' || ctx.role === 'admin';
}
