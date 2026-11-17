import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// `fileURLToPath`, not `.pathname`: a checkout under a directory with a space would otherwise
// percent-encode the path and the guard would fail instead of checking the sources.
const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const THE_ONE_SENDER = 'modules/notifications/push.ts';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(join(dir, entry.name))
      : entry.name.endsWith('.ts')
        ? [join(dir, entry.name)]
        : [],
  );
}

it('only push.ts talks to a push service: every message goes through notify', () => {
  const talkers = sources(SRC)
    .filter((file) => /from 'web-push'|sendNotification\(/.test(readFileSync(file, 'utf8')))
    .map((file) => relative(SRC, file));
  expect(talkers).toEqual([THE_ONE_SENDER]);
});
