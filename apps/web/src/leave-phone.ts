import { clearToken, signOut } from './api.js';
import { disablePush } from './push.js';

/** Ending this phone's session also ends its alerts, so a signed-out phone never rings. */
export async function leaveThisPhone(): Promise<void> {
  await disablePush();
  await signOut().catch(() => undefined);
  clearToken();
}
