/**
 * The channels a person raises a live breakdown through. `import` and `backfill` are history, and `pm` and
 * `inspection` are planned work: neither takes an SLA clock, appears in the drift list, escalates, or counts as a
 * live breakdown in analytics. One predicate, so every reader agrees on what a breakdown channel is.
 */
export const BREAKDOWN_CHANNELS = ['floor', 'desk', 'whatsapp', 'qr'] as const;
export type BreakdownChannel = (typeof BREAKDOWN_CHANNELS)[number];

export function isBreakdownChannel(channel: string | null | undefined): boolean {
  return (BREAKDOWN_CHANNELS as readonly string[]).includes(channel ?? '');
}

/**
 * The channels planned work is raised through: a PM job from a plan (49) or an inspection from a forecast run (52).
 * A person never raises these through the HTTP surface; they are ordinary tickets otherwise.
 */
export const PLANNED_CHANNELS = ['pm', 'inspection'] as const;
export type PlannedChannel = (typeof PLANNED_CHANNELS)[number];

export function isPlannedChannel(channel: string | null | undefined): boolean {
  return (PLANNED_CHANNELS as readonly string[]).includes(channel ?? '');
}
