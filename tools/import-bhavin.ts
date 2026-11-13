import { main } from '../apps/server/src/modules/imports/cli.js';

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
