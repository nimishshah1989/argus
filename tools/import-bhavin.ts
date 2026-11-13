import { main } from '../apps/server/src/seed/import-cli.js';

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
