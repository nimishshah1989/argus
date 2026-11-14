import { cpSync } from 'node:fs';
import { build } from 'esbuild';

await build({
  entryPoints: ['apps/server/src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  outfile: 'apps/server/dist/server.mjs',
  external: ['@node-rs/argon2'],
  sourcemap: true,
  // Bundled CommonJS dependencies (fastify, avvio, ...) call require(); an ESM bundle has none of its own.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: 'info',
});

cpSync('apps/server/src/modules/ai/prompts', 'apps/server/dist/prompts', { recursive: true });
