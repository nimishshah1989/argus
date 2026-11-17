import type { Lockout, LockoutStep } from '@uptimo/shared/lockout';
import type { MessageKey } from '@uptimo/shared/i18n';
import { ApiError } from '../api.js';

/** What the ticket page shows about lockout for the person using it; `null` means nothing (no lockout, or not theirs to act on). */
export type LockoutView =
  | { kind: 'ticking'; steps: LockoutStep[] }
  | { kind: 'confirmed'; steps: LockoutStep[]; at: string; byPersonId: string }
  | { kind: 'record'; steps: LockoutStep[] }
  | { kind: 'missing' };

/** The commands the server refuses until the acting person's confirmation stands (start, pick up, resume, join). */
const GATED = new Set(['start', 'resume', 'join']);

export interface ViewInput {
  lockout: Lockout | null | undefined;
  status: string;
  personId: string;
  /** In the crew of a ticket being worked. */
  onCrew: boolean;
  /** The actions the action bar offers this person. */
  offered: readonly string[];
}

export function lockoutView(input: ViewInput): LockoutView | null {
  const { lockout, personId } = input;
  if (!lockout) return null;
  if (lockout.steps.length === 0) return { kind: 'missing' };
  const mine = lockout.confirmations.find((c) => c.byPersonId === personId);
  if (mine) return { kind: 'confirmed', steps: lockout.steps, at: mine.at, byPersonId: personId };
  if (input.offered.some((action) => GATED.has(action))) {
    return { kind: 'ticking', steps: lockout.steps };
  }
  // Reopened or restored to working: the server asks nothing more, so this is a record, not a block.
  if (input.onCrew && input.status === 'working') return { kind: 'record', steps: lockout.steps };
  return null;
}

/** Whether the action bar holds this button back until every step is ticked. */
export function isGated(view: LockoutView | null, action: string): boolean {
  return (view?.kind === 'ticking' || view?.kind === 'missing') && GATED.has(action);
}

const REFUSALS: Record<string, MessageKey> = {
  lockout_required: 'lockout.refused',
  steps_changed: 'lockout.stepsChanged',
  lockout_steps_missing: 'lockout.noSteps',
};

/** The floor's words for a lockout refusal, or `null` when the failure is some other one. */
export function lockoutRefusalKey(error: unknown): MessageKey | null {
  return error instanceof ApiError ? (REFUSALS[error.code] ?? null) : null;
}

/** The plant keeps each step in English, Gujarati and Hindi; the app shows English or Gujarati. */
export function localisedLabel(step: LockoutStep, language: string): string {
  return (language === 'gu' ? step.labelGu : null) || step.label;
}
