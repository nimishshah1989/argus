import { DEFAULT_PROFILE, PROFILE_KEYS, type ProfileKey } from '@uptimo/shared/analytics';
import type { GlossaryReply } from '@uptimo/shared/plant-settings';
import type { ProfileRow } from './analytics-profile-spec.js';
import type { ListsPage } from './lists-specs.js';

/** One list's count of active entries, in `LIST_PAGES` order. */
export type ListCount = { page: ListsPage; n: number };
/** The longest list, out of every active entry across the lists. */
export type ListsTakeaway = { page: ListsPage; n: number; total: number };
/** Active glossary terms by the script they are written in (`direction`). */
export type GlossaryTakeaway = { total: number; gu: number; guLatn: number; en: number };
/**
 * The profile numbers still equal to the shipped default (ADR 0056), out of every number. The reply never
 * carries null: the server stores the defaults on the first read and the route (head and admin) sends every key.
 */
export type ProfileTakeaway = { onDefault: ProfileKey[]; total: number };
/** One list on the hub: its items once they arrive, and whether its read failed with nothing to show. */
export type HubList = {
  page: ListsPage;
  items: readonly { active: boolean }[] | undefined;
  failed: boolean;
};
/** A tile's count of active entries; null until the list arrives (never a false 0). */
export type HubCount = { page: ListsPage; n: number | null };
/** `error` when any list failed, else `loading` while any is missing, else `ready`. */
export type HubState = { state: 'loading' | 'error' | 'ready'; counts: HubCount[] };

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

/** `onDefault` in `PROFILE_KEYS` order; `total` is every profile number. */
export function profileTakeaway(row: ProfileRow): ProfileTakeaway {
  void row;
  void DEFAULT_PROFILE;
  void PROFILE_KEYS;
  throw new Error('not implemented');
}

/** The hub's state and one count per list, in the order given. */
export function listsHub(lists: readonly HubList[]): HubState {
  void lists;
  throw new Error('not implemented');
}
