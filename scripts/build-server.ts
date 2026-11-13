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
  logLevel: 'info',
});
