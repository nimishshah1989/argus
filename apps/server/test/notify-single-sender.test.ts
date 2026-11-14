import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, it } from 'vitest';

const SRC = new URL('../src/', import.meta.url).pathname;
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
