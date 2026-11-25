import type { LoginAdmin, PersonAdmin } from '@uptimo/shared/people';

/** Active people, and how many have no phone (null or blank). */
export type PeopleTakeaway = { total: number; noPhone: number };
/** Active logins, and how many are shared (a floor phone, no person). */
export type LoginsTakeaway = { total: number; shared: number };

/** Null when there is no active person. */
export function peopleTakeaway(rows: readonly PersonAdmin[]): PeopleTakeaway | null {
  void rows;
  throw new Error('not implemented');
}

/** Null when there is no active login. */
export function loginsTakeaway(rows: readonly LoginAdmin[]): LoginsTakeaway | null {
  void rows;
  throw new Error('not implemented');
}
