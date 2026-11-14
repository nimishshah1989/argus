import type { ActorContext } from '../types.js';

const HEAD_ADMIN = ['head', 'admin'] as const;

export function canSettingsLists(ctx: ActorContext): boolean {
  return (HEAD_ADMIN as readonly string[]).includes(ctx.role);
}

/** The admin on a personal login: an admin action in the audit must name a person, which a shared phone cannot. */
export function canSettingsPeople(ctx: ActorContext): boolean {
  return ctx.role === 'admin' && !ctx.shared;
}

export function canSettingsSla(ctx: ActorContext): boolean {
  return (HEAD_ADMIN as readonly string[]).includes(ctx.role);
}

/** AI consent and monthly spending cap (D22): the admin alone, not the head. */
export function canSettingsAi(ctx: ActorContext): boolean {
  return ctx.role === 'admin';
}

/**
 * Approve, see and end our own staff's access to this customer (D29): the admin on a personal login, so the
 * approval names one person.
 */
export function canManageSupportAccess(ctx: ActorContext): boolean {
  return ctx.role === 'admin' && !ctx.shared;
}
