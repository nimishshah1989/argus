import type { QueryClient } from '@tanstack/react-query';
import { chooseActing, getMe } from '../../api.js';
import { forgetEveryone } from '../../data/index.js';
import { replayOutbox } from '../../offline/replay.js';
import { ensurePushBinding } from '../../push.js';

/**
 * This phone is now used by `personId`: tell the server, take who is acting from it, follow them with alerts, send what
 * they queued earlier, and forget everything saved for the person before (figures, role, lists, saved reads).
 */
export async function actAs(client: QueryClient, personId: string) {
  await chooseActing(personId);
  const me = await getMe();
  // A shared phone that already allows alerts follows the person now using it, and only them.
  await ensurePushBinding(personId).catch(() => undefined);
  // What this person queued earlier on this phone goes now (review of PR 225); others' stays held.
  await replayOutbox().catch(() => undefined);
  forgetEveryone(client);
  return me;
}
