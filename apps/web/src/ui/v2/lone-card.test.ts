// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./cards.css', import.meta.url), 'utf8');

describe('a card alone in its row (ADR 0065)', () => {
  it('spans the whole row: an only card on any grid, and the odd last card of a two-column grid', () => {
    expect(css).toMatch(
      /\.v2-grid > :only-child,\s*\.v2-grid-2 > :last-child:nth-child\(odd\) \{\s*grid-column: 1 \/ -1;\s*\}/,
    );
  });
});
