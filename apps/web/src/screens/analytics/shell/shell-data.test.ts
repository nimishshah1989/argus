import { describe, expect, it } from 'vitest';
import { en, gu } from '@uptimo/shared/i18n';
import { ANALYTICS_GROUPS } from '../groups.js';
import { SECTIONS, locate, place, searchEntries, sectionsFor } from './shell-data.js';

const names = (role: string | undefined) => sectionsFor(role).map((section) => section.id);
const tabsOf = (role: string, id: string) =>
  sectionsFor(role)
    .find((section) => section.id === id)
    ?.tabs.map((tab) => tab.to);

describe('the shell menu', () => {
  it('has at most six sections and the Guide', () => {
    expect(SECTIONS.filter((section) => section.id !== 'guide').length).toBeLessThanOrEqual(6);
    expect(SECTIONS.at(-1)?.id).toBe('guide');
  });

  it('puts every analytics route under a section, so no screen is unreachable', () => {
    for (const group of ANALYTICS_GROUPS) {
      const found = locate(`/analytics/${group.id}`, '');
      expect(found, group.id).not.toBeNull();
    }
    expect(locate('/analytics/today/checklist', '')?.section.id).toBe('today');
    expect(locate('/analytics/today/action-center', '')?.section.id).toBe('today');
    expect(locate('/analytics/machines/abc', '')?.section.id).toBe('machines');
  });

  it('names every label in both catalogues', () => {
    for (const section of SECTIONS)
      for (const key of [section.label, ...section.tabs.map((tab) => tab.label)]) {
        expect(en[key], key).toBeTruthy();
        expect(Object.keys(gu), key).toContain(key);
      }
  });
});

describe('which sections a login sees', () => {
  it('shows a head, a plant head and an admin all of them', () => {
    for (const role of ['head', 'plant_head', 'admin'])
      expect(names(role), role).toEqual(SECTIONS.map((section) => section.id));
  });

  it('keeps money from a supervisor but not the rest of People', () => {
    expect(names('supervisor')).toContain('people');
    expect(tabsOf('supervisor', 'people')).toEqual(['/analytics/today?screen=team-focus']);
    expect(tabsOf('head', 'people')).toContain('/analytics/cost');
  });

  it('gives a login the engine refuses the Guide alone', () => {
    for (const role of ['board', 'operator', 'technician'])
      expect(names(role), role).toEqual(['guide']);
  });

  it('shows everything while the role is still loading', () => {
    expect(names(undefined)).toEqual(SECTIONS.map((section) => section.id));
  });
});

describe('which tab a page marks', () => {
  it('marks Team focus on its query and the dashboard on the bare route', () => {
    expect(locate('/analytics/today', 'screen=team-focus')?.section.id).toBe('people');
    expect(locate('/analytics/today', '')?.tab.to).toBe('/analytics/today');
    expect(locate('/analytics/today', 'drill=machine%3Aa')?.tab.to).toBe('/analytics/today');
  });

  it('knows no page outside the map', () => {
    expect(locate('/desk', '')).toBeNull();
  });
});

describe('the search entries', () => {
  it('lists each section, its tabs and the screens inside a group page', () => {
    const entries = searchEntries(sectionsFor('head'));
    const to = entries.map((entry) => entry.to);
    expect(to).toContain('/analytics/breakdowns');
    expect(to).toContain('/analytics/breakdowns?screen=a3-mttr-mtbf');
    expect(to).toContain('/analytics/pm');
    expect(to).toContain('/analytics/cost');
    expect(searchEntries(sectionsFor('supervisor')).map((entry) => entry.to)).not.toContain(
      '/analytics/cost',
    );
  });
});

describe('the reliability tabs', () => {
  it('has A9 and the Forecast Lab as tabs, so the section needs no second menu', () => {
    expect(tabsOf('head', 'reliability')).toEqual([
      '/analytics/forecast-scorecard',
      '/analytics/forecast-scorecard?screen=forecast-lab',
    ]);
    expect(locate('/analytics/forecast-scorecard', '')?.tab.to).toBe(
      '/analytics/forecast-scorecard',
    );
    expect(locate('/analytics/forecast-scorecard', 'screen=forecast-lab')?.tab.to).toBe(
      '/analytics/forecast-scorecard?screen=forecast-lab',
    );
  });
});

describe('the reports tabs', () => {
  it('has Monthly, Annual and the PM calendar as tabs, so the reports need no second menu', () => {
    expect(tabsOf('head', 'reports')).toEqual([
      '/analytics/reports',
      '/analytics/reports?screen=annual-report',
      '/analytics/pm',
    ]);
    expect(locate('/analytics/reports', '')?.tab.to).toBe('/analytics/reports');
    expect(locate('/analytics/reports', 'screen=annual-report')?.tab.to).toBe(
      '/analytics/reports?screen=annual-report',
    );
  });
});

describe('a page the login may not open', () => {
  it('is not marked or headed as the Money page for a supervisor', () => {
    const shown = place(sectionsFor('supervisor'), '/analytics/cost', '');
    expect(shown.tab).toBeNull();
    expect(shown.section.id).toBe('today');
    expect(place(sectionsFor('head'), '/analytics/cost', '').tab?.to).toBe('/analytics/cost');
    expect(place(sectionsFor('board'), '/analytics/machines', '').section.id).toBe('guide');
  });
});
