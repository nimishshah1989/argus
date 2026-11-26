import { PROFILE_KEYS, type ProfileKey } from '@uptimo/shared/analytics';
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
  const total = counts.reduce((sum, c) => sum + c.n, 0);
  if (total === 0) return null;
  const top = counts.reduce((best, c) => (c.n > best.n ? c : best));
  return { page: top.page, n: top.n, total };
}

/** Null when there is no active term. */
export function glossaryTakeaway(terms: readonly GlossaryReply[]): GlossaryTakeaway | null {
  const active = terms.filter((term) => term.active);
  if (active.length === 0) return null;
  const of = (direction: GlossaryReply['direction']) =>
    active.filter((term) => term.direction === direction).length;
  return { total: active.length, gu: of('gu'), guLatn: of('gu-Latn'), en: of('en') };
}

/** `notSet` in `PROFILE_KEYS` order; a key absent from the row is never counted. */
export function profileTakeaway(row: ProfileRow): ProfileTakeaway {
  const present = PROFILE_KEYS.filter((key) => key in row && row[key] !== undefined);
  return { notSet: present.filter((key) => row[key] === null), total: present.length };
}
