// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { drillHref, parseDrill } from '../../analytics/groups.js';
import { realReply } from '../figures/real-reply.js';
import { NO_SUCH_FIGURE, figureForLegacyDrill, searchForLegacyDrill } from './legacy.js';

const reply = realReply();
const counted = reply.figures.filter(
  (figure) => figure.status === 'ready' && figure.drill.ids.length > 0,
);

/** What the old tiles linked to, read back the way the v2 screen reads an address. */
const asked = (figure: (typeof counted)[number]) => {
  const href = drillHref('machines', figure.drill.type, figure.drill.ids);
  return parseDrill(new URLSearchParams(href.split('?')[1]).get('drill'))!;
};

describe('an old ?drill= link opens the rows of the figure it was made on', () => {
  it('finds, for every figure that counts rows, a figure with exactly those rows', () => {
    expect(counted.length).toBeGreaterThan(5);
    for (const figure of counted) {
      const key = figureForLegacyDrill(reply, asked(figure), '');
      const found = counted.find((candidate) => candidate.key === key)!;
      expect(found, figure.key).toBeDefined();
      expect([...found.drill.ids].sort(), figure.key).toEqual([...figure.drill.ids].sort());
    }
  });

  it('prefers the screen’s own figure when two figures count the same rows', () => {
    for (const figure of counted) {
      const same = counted.filter(
        (other) =>
          other.drill.type === figure.drill.type &&
          [...other.drill.ids].sort().join() === [...figure.drill.ids].sort().join(),
      );
      if (same.length > 1)
        for (const other of same)
          expect(figureForLegacyDrill(reply, asked(figure), other.key)).toBe(other.key);
    }
  });

  it('names no figure for rows nothing counts, so the panel says it has none', () => {
    expect(
      figureForLegacyDrill(reply, { type: 'machine', ids: ['not-a-machine'] }, 'registers'),
    ).toBe(NO_SUCH_FIGURE);
  });

  it('turns the address into the panel’s own: drill gone, drawer set, the rest kept', () => {
    expect(searchForLegacyDrill('?drill=machine%3Aa%2Cb&register=dg', 'registers')).toBe(
      '?register=dg&drawer=figure:registers',
    );
    expect(searchForLegacyDrill('?drill=ticket%3Ax', 'a10-problems')).toBe(
      '?drawer=figure:a10-problems',
    );
  });
});
