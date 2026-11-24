// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { OWNER_PREFIX } from './adapter.js';
import { OwnerDetail } from './detail.js';
import { teamFocusFixture } from './fixture.js';
import { TeamFocusView } from './View.js';

/** Review 1 of 594: no handler, no "I'll take it"; an owner with no actions still names the owner. */

const nav = [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }];
const first = teamFocusFixture.start[0]!;
const html = (props: object, url = '/analytics/today?screen=team-focus') =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [url] },
      createElement(TeamFocusView, { model: teamFocusFixture, nav, title: 'Team Focus', ...props }),
    ),
  );
const count = (markup: string, needle: string) => markup.split(needle).length - 1;

describe('the Team Focus assign button', () => {
  it('shows one on every list row when the page can assign', () => {
    const page = html({ onAssign: () => {}, onUnassign: () => {} });
    expect(count(page, `>${first.action}<`)).toBeGreaterThanOrEqual(1);
    expect(count(page, 'v2-btn-primary')).toBeGreaterThanOrEqual(teamFocusFixture.start.length);
  });

  it('shows none on the list rows when the page cannot assign', () => {
    const page = html({});
    expect(page).toContain(first.title);
    expect(page).not.toContain(`>${first.action}<`);
  });
});

describe('the owner drawer', () => {
  it('names an owner who holds no actions', () => {
    const markup = renderToStaticMarkup(
      createElement(OwnerDetail, { model: teamFocusFixture, chipId: `${OWNER_PREFIX}Nobody Here` }),
    );
    expect(markup).toContain('Nobody Here');
  });
});
