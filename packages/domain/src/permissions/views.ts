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
