import type { Query, QueryClient, QueryKey } from '@tanstack/react-query';
import { forgetCachedReads } from '../offline/cache.js';
import { whenSessionChanges } from './client.js';
import { currentWho } from './who.js';

/**
 * Whom each saved answer was fetched for. The cache is in the tab's memory and outlives a sign-out that does not reload,
 * and the server decides what a person may see (money by role), so an answer may be shown again only to the login and
 * acting person it was fetched for. Every answer is stamped with who this phone is acting as at the moment it is saved.
 */
const owners = new WeakMap<Query, string>();

/** Who this phone is acting as, as one word: the login and the person; empty when nobody is signed in. */
export function personKey(): string {
  const who = currentWho();
  return who ? `${who.loginId}:${who.actingPersonId}` : '';
}

/** Start stamping every answer the client saves with the person it was fetched for. Returns the client. */
export function keepOwners(client: QueryClient): QueryClient {
  client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success')
      owners.set(event.query, personKey());
  });
  return client;
}

/** Whether what the cache holds under this key was fetched for the person acting now. An answer with no stamp is not. */
export function isOwnCopy(client: QueryClient, key: QueryKey): boolean {
  const query = client.getQueryCache().find({ queryKey: key, exact: true });
  return query !== undefined && owners.get(query) === personKey();
}

/** Sign-out, sign-in or a change of the acting person: nothing saved for the last person is kept for the next. */
export function forgetEveryone(client: QueryClient): void {
  client.clear();
  forgetCachedReads();
}

/** What the app does at start: stamp every saved answer with its person, and forget them all when the session changes. */
export function keepPeopleApart(client: QueryClient): QueryClient {
  whenSessionChanges(() => forgetEveryone(client));
  return keepOwners(client);
}
