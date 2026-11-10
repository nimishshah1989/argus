import { stopStackFromState } from './stack.js';

/**
 * Safety net for runs where globalSetup's returned cleanup did not run (for example a
 * killed process): stop the API, the web server and the container recorded on disk.
 */
export default async function globalTeardown(): Promise<void> {
  await stopStackFromState();
}
