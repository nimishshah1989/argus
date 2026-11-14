import { refuse, type Refusal } from './contract.js';

/**
 * The one rule for who acts: the person this session says (the login's own, or the one chosen on a shared phone).
 * A request may leave the person out or repeat that person; naming anyone else is refused, so a phone can never
 * act, be recorded or be credited as someone it is not. Returns the refusal, or null when the request may go on.
 */
export function actingRefusal(
  auth: { shared: boolean; personId: string | null },
  named: string | undefined,
  field: string,
): Refusal | null {
  if (auth.personId === null) {
    return auth.shared
      ? refuse(403, 'choose_acting_person', 'Choose who is using this phone to continue')
      : refuse(403, 'forbidden', 'You may only act as yourself', field);
  }
  return named === undefined || named === auth.personId
    ? null
    : refuse(403, 'forbidden', 'You may only act as yourself', field);
}
