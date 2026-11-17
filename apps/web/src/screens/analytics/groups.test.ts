import { describe, expect, it } from 'vitest';
import { FIGURES, FIGURE_KEYS } from '@uptimo/domain';
import { en, gu } from '@uptimo/shared/i18n';
import {
  ANALYTICS_GROUPS,
  FIGURE_LABELS,
  GROUP_LABELS,
  SCREEN_LABELS,
  drillHref,
  groupOfScreen,
  parseDrill,
} from './groups.js';

/**
 * The face is built from the registry: a figure that is registered but sits in no menu group, or one that
 * has no catalogue label, would be a number no screen can show. These checks fail first when 38 to 45
 * register more.
 */
describe('every registered figure is reachable from the menu', () => {
  it('puts every figure in exactly one group', () => {
    for (const figure of FIGURES) {
      const groups = ANALYTICS_GROUPS.filter((group) => group.screens.includes(figure.screen));
      expect(
        groups.map((group) => group.id),
        figure.key,
      ).toHaveLength(1);
    }
  });

  it('assigns every registry screen to a group, and names no screen the registry does not have', () => {
    const screens = new Set(FIGURES.map((figure) => figure.screen));
    const assigned = ANALYTICS_GROUPS.flatMap((group) => group.screens);
    expect(new Set(assigned).size).toBe(assigned.length);
    for (const screen of screens) expect(assigned, screen).toContain(screen);
    for (const screen of assigned) expect(screens.has(screen), screen).toBe(true);
    for (const screen of screens) expect(groupOfScreen(screen), screen).not.toBeNull();
  });

  it('names every screen, every group and every figure in both catalogues', () => {
    for (const group of ANALYTICS_GROUPS) {
      expect(en[GROUP_LABELS[group.id]], group.id).toBeTruthy();
      expect(Object.keys(gu), group.id).toContain(GROUP_LABELS[group.id]);
    }
    for (const screen of new Set(FIGURES.map((figure) => figure.screen))) {
      expect(SCREEN_LABELS[screen], screen).toBeTruthy();
      expect(en[SCREEN_LABELS[screen]!], screen).toBeTruthy();
      expect(Object.keys(gu), screen).toContain(SCREEN_LABELS[screen]!);
    }
    for (const key of FIGURE_KEYS) {
      expect(FIGURE_LABELS[key], key).toBeTruthy();
      expect(en[FIGURE_LABELS[key]!], key).toBeTruthy();
      expect(Object.keys(gu), key).toContain(FIGURE_LABELS[key]!);
    }
  });
});

describe('a drill link names its type and rows', () => {
  it('builds and reads the query the shell fetches', () => {
    const href = drillHref('today', 'ticket', ['10000000-0000-0000-0000-000000000001']);
    expect(href).toBe('/analytics/today?drill=ticket%3A10000000-0000-0000-0000-000000000001');
    expect(parseDrill('ticket:10000000-0000-0000-0000-000000000001')).toEqual({
      type: 'ticket',
      ids: ['10000000-0000-0000-0000-000000000001'],
    });
    expect(parseDrill('ticket:a,b')).toEqual({ type: 'ticket', ids: ['a', 'b'] });
  });

  it('refuses a type the engine does not drill to, or an empty row list', () => {
    expect(parseDrill(null)).toBeNull();
    expect(parseDrill('bogus:a')).toBeNull();
    expect(parseDrill('machine:')).toBeNull();
    expect(parseDrill('machine:,')).toBeNull();
  });
});
