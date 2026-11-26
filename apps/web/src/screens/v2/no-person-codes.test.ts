// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ADR 0058 (Nimish, 26 Nov): screens show people by name. The server swaps the engine's person codes for names on
// the way out, so a v2 screen's fixture or the gallery's stored replies must never print a code where a name exists.
const CODE = /\bP-[0-9a-f]{8}\b/;
const here = new URL('.', import.meta.url);

/** Every fixture file of every v2 screen: a new screen's fixture joins the check with no list to edit. */
const fixtures = readdirSync(here, { recursive: true, encoding: 'utf8' })
  .filter((path) => /(^|\/)fixture[^/]*\.(ts|tsx|json)$/.test(path) && !path.includes('.test.'))
  .map((path) => ({ path, text: readFileSync(new URL(path, here), 'utf8') }));

describe('no v2 screen prints a person code (ADR 0058)', () => {
  it('finds the fixtures it checks', () => {
    expect(fixtures.length).toBeGreaterThan(20);
  });

  it.each(fixtures.map((fixture) => [fixture.path, fixture.text]))('%s', (_path, text) => {
    expect(text).not.toMatch(CODE);
  });

  it('the gallery’s stored replies', () => {
    const replies = readFileSync(
      new URL('../../gallery/rows-behind/generated/replies.json', here),
      'utf8',
    );
    expect(replies).not.toMatch(CODE);
  });
});
