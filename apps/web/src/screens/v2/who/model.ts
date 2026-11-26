import type { MessageKey } from '@uptimo/shared/i18n';

/** One person this shared phone may act as (GET /auth/acting). */
export type WhoChoice = { id: string; name: string };

/** The "Your name" options: the people the server offers, sorted by name (`localeCompare`), the input left untouched. */
export function whoChoices(people: readonly WhoChoice[]): WhoChoice[] {
  void people;
  throw new Error('not implemented');
}

/**
 * What the screen says when choosing fails: an `ApiError` on field `actingPersonId` is `signin.chooseName`; anything
 * else is null (the caller rethrows it). Moved unchanged from v1 `faces/signin/who.tsx`.
 */
export function whoError(error: unknown): MessageKey | null {
  void error;
  throw new Error('not implemented');
}
