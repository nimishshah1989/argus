import type { ActorContext } from '../types.js';

const HEAD_ADMIN = ['head', 'admin'] as const;

export function canSettingsLists(ctx: ActorContext): boolean {
  return (HEAD_ADMIN as readonly string[]).includes(ctx.role);
}

export function canSettingsPeople(ctx: ActorContext): boolean {
  return ctx.role === 'admin';
}

export function canSettingsSla(ctx: ActorContext): boolean {
  return (HEAD_ADMIN as readonly string[]).includes(ctx.role);
}

/** AI consent and monthly spending cap (D22): the admin alone, not the head. */
export function canSettingsAi(ctx: ActorContext): boolean {
  return ctx.role === 'admin';
}
