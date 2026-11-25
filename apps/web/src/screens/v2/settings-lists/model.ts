import type { ProfileKey } from '@uptimo/shared/analytics';
import type { GlossaryReply } from '@uptimo/shared/plant-settings';
import type { ProfileRow } from './analytics-profile-spec.js';
import type { ListsPage } from './lists-specs.js';

/** One list's count of active entries, in `LIST_PAGES` order. */
export type ListCount = { page: ListsPage; n: number };
/** The longest list, out of every active entry across the lists. */
export type ListsTakeaway = { page: ListsPage; n: number; total: number };
/** Active glossary terms by the script they are written in (`direction`). */
export type GlossaryTakeaway = { total: number; gu: number; guLatn: number; en: number };
/** Profile numbers present on the row (money keys are absent for a login without money rights) and those not set. */
export type ProfileTakeaway = { notSet: ProfileKey[]; total: number };

/** Null when every list is empty; a tie goes to the list first in order. */
export function listsTakeaway(counts: readonly ListCount[]): ListsTakeaway | null {
  void counts;
  throw new Error('not implemented');
}

/** Null when there is no active term. */
export function glossaryTakeaway(terms: readonly GlossaryReply[]): GlossaryTakeaway | null {
  void terms;
  throw new Error('not implemented');
}

/** `notSet` in `PROFILE_KEYS` order; a key absent from the row is never counted. */
export function profileTakeaway(row: ProfileRow): ProfileTakeaway {
  void row;
  throw new Error('not implemented');
}
