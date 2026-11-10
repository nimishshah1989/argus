import { API_URL, WEB_URL } from './fixtures.js';
import { clearStackState, startStack, stopStack, writeStackState } from './stack.js';

/**
 * Boots the real stack once per `playwright test` run and hands Playwright a cleanup
 * function (the in-process teardown) plus a state file used by teardown.ts as a fallback.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const handles = await startStack();
  writeStackState(handles);
  console.log(`e2e: stack ready — api ${API_URL}, web ${WEB_URL}`);
  return async () => {
    await stopStack(handles);
    clearStackState();
    console.log('e2e: stack stopped');
  };
}
