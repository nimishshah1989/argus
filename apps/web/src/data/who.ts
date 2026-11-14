/**
 * Who this phone is acting as right now: the login and the person, cached at sign-in and whenever
 * `/auth/me` answers, so an offline command records who made it and replay never sends it as
 * someone else (review of PR 225).
 */
const KEY = 'uptimo_who';

export interface Who {
  loginId: string;
  /** '' on a shared phone where nobody has said who is using it yet. */
  actingPersonId: string;
  name: string;
}

export function rememberWho(user: { id: string; actingPersonId: string; name: string }): void {
  const who: Who = { loginId: user.id, actingPersonId: user.actingPersonId, name: user.name };
  try {
    localStorage.setItem(KEY, JSON.stringify(who));
  } catch {
    // Storage blocked: queued commands then record nobody and are held, never sent as someone else.
  }
}

export function currentWho(): Who | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Who) : null;
  } catch {
    return null;
  }
}

/** The person this browser's push subscription was last registered for (push.ts reads and writes it). */
export const PUSH_BOUND_KEY = 'uptimo.push.person';

/** A session ending removes the phone's push row on the server, so the next open must register again. */
export function forgetPushBinding(): void {
  try {
    localStorage.removeItem(PUSH_BOUND_KEY);
  } catch {
    // Nothing stored to forget.
  }
}

export function forgetWho(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing cached to forget.
  }
}

/** A queued command belongs to this phone's current person only if the same login and person made it. */
export function isMine(entryWho: Who | undefined, now: Who | null): boolean {
  return Boolean(
    entryWho &&
    now?.actingPersonId &&
    entryWho.loginId === now.loginId &&
    entryWho.actingPersonId === now.actingPersonId,
  );
}
