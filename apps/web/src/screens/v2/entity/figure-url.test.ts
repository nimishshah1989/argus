// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { figureFrom, searchWithFigure } from './url.js';

describe('the rows-behind drawer in the URL', () => {
  it('reads the figure from ?drawer=figure:<key>, as written', () => {
    expect(figureFrom('?drawer=figure:dashboard.pm-hours')).toBe('dashboard.pm-hours');
    expect(figureFrom('?view=v2-rows-behind&drawer=figure:cell-change-log&x=1')).toBe(
      'cell-change-log',
    );
  });

  it('asks for nothing when the drawer is an entity, empty or malformed', () => {
    for (const q of ['', '?drawer=', '?drawer=figure', '?drawer=figure:', '?drawer=machine:TC-12'])
      expect(figureFrom(q)).toBeNull();
  });

  it('writes the figure without touching the other parameters, replaces any drawer, and removes it again', () => {
    const open = searchWithFigure('?view=v2-rows-behind&theme=dark', 'dashboard.pm-hours');
    expect(open).toBe('?view=v2-rows-behind&theme=dark&drawer=figure:dashboard.pm-hours');
    expect(searchWithFigure('?drawer=machine:TC-12&view=a', 'cell-change-log')).toBe(
      '?view=a&drawer=figure:cell-change-log',
    );
    expect(searchWithFigure(open, null)).toBe('?view=v2-rows-behind&theme=dark');
    expect(searchWithFigure('?drawer=figure:a', null)).toBe('');
  });
});
