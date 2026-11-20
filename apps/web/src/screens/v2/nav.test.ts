import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import type { MessageKey } from '@uptimo/shared/i18n';
import { filterEntries } from '../../ui/v2/palette-match.js';
import { searchEntries, sectionsFor } from '../analytics/shell/shell-data.js';
import { navItems, paletteEntries } from './nav.js';

const say =
  (catalogue: Record<string, string>) => (key: MessageKey, values?: Record<string, string>) =>
    (catalogue[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => values?.[name] ?? '');
const english = say(en);
const rail = (role: string | undefined) => navItems('machines', role, (key) => english(key));
const find = (role: string | undefined, query: string, t = english) =>
  filterEntries(paletteEntries(searchEntries(sectionsFor(role)), t), query).map((row) => row.to);

describe('the rail', () => {
  it('ends with the way out to the desk for every login, as v1 showed it', () => {
    for (const role of [
      'operator',
      'board',
      'technician',
      'supervisor',
      'head',
      'plant_head',
      'admin',
      undefined,
    ])
      expect(rail(role).at(-1), String(role)).toMatchObject({ label: 'Desk', href: '/desk' });
  });

  it('gives a login the engine refuses the Guide and the desk, and nothing else', () => {
    for (const role of ['operator', 'board'])
      expect(
        rail(role).map((item) => item.label),
        role,
      ).toEqual(['Guide', 'Desk']);
  });

  it('marks the section you are on, and keeps the order the shell has', () => {
    const items = rail('head');
    expect(items.filter((item) => item.current).map((item) => item.id)).toEqual(['machines']);
    expect(items.map((item) => item.label)).toEqual([
      'Today',
      'Machines',
      'Problems',
      'Reliability & forecast',
      'People & money',
      'Reports',
      'Guide',
      'Desk',
    ]);
  });
});

describe('the search over the pages', () => {
  it('finds a screen inside a section by its name, and says where it sits', () => {
    expect(find('head', 'mttr')).toEqual(['/analytics/breakdowns?screen=a3-mttr-mtbf']);
    const row = paletteEntries(searchEntries(sectionsFor('head')), english).find(
      (entry) => entry.to === '/analytics/breakdowns?screen=a3-mttr-mtbf',
    );
    expect(row?.hint).toBe('Screen in Problems');
    expect(
      paletteEntries(searchEntries(sectionsFor('head')), english).find(
        (entry) => entry.to === '/analytics/breakdowns',
      )?.hint,
    ).toBe('Section');
  });

  it('lists money only to a login that may read it', () => {
    expect(find('head', 'money')).toContain('/analytics/cost');
    expect(find('supervisor', 'money')).not.toContain('/analytics/cost');
  });

  it('offers a login the engine refuses the Guide and nothing else', () => {
    expect(find('operator', '')).toEqual(['/analytics/guide']);
  });
});
