// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { realT } from '../printed-page/test-support.js';
import { teamFocusFixture } from './fixture.js';
import type { ActionRow, TeamFocusModel } from './model.js';
import { TeamFocusView } from './View.js';
import { laneTally, noteBody, ownerRows } from './writes.js';

/** TF-3 (ADR 0020): the live screen's writes, its action and owner drawers, the saved note and the page drill. */

const owner = (name: string) => ({ kind: 'person' as const, id: `owner:${name}`, label: name });
const machine = (code: string) => ({ kind: 'machine' as const, id: code, label: code });
const row = (over: Partial<ActionRow> & Pick<ActionRow, 'id' | 'title'>): ActionRow => ({
  kind: 'fix',
  kindLabel: 'Fix for good',
  chips: [],
  owner: null,
  status: 'todo',
  statusLabel: 'Not started',
  hours: { shown: '1.0 h', value: 1 },
  note: '',
  ...over,
});
const SPINDLE = row({
  id: 'fixg|Spindle',
  title: 'Spindle: one of the biggest losses',
  chips: [machine('VC-1')],
  owner: owner('Meera K'),
  status: 'doing',
  statusLabel: 'In progress',
  hours: { shown: '10.0 h', value: 10 },
  note: 'Ordered bearings',
});
const COOLANT = row({
  id: 'fixm|m2|Coolant',
  title: 'TC-2: coolant leak has come back 4 times',
  chips: [machine('TC-2')],
});
const SAW = row({
  id: 'ovh|m3',
  kind: 'decide',
  kindLabel: 'Overhaul or replace?',
  title: 'BS-4 (Saw): decide on overhaul or replacement',
  owner: owner('Meera K'),
  status: 'done',
  statusLabel: 'Done',
});
const DRILL = { figure: 'team-focus', label: 'Show the machines behind Team Focus' };
const MODEL: TeamFocusModel = {
  ...teamFocusFixture,
  start: [],
  people: [],
  rebalance: null,
  actions: [SPINDLE, COOLANT, SAW],
  drill: DRILL,
};

const nav = [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }];
const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const render = (model: TeamFocusModel, url = '/analytics/today?screen=team-focus') =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [url] },
      createElement(TeamFocusView, { model, nav, title: 'Team Focus' }),
    ),
  );
const drawer = (ref: string) => render(MODEL, `/analytics/today?screen=team-focus&drawer=${ref}`);

describe('Team Focus writes (TF-3)', () => {
  it('saves one change and keeps every field it did not touch, in the stored words', () => {
    expect(noteBody(MODEL, '2026-12', SPINDLE.id, { status: 'done' })).toEqual({
      period: '2026-12',
      action: 'fixg|Spindle',
      status: 'done',
      owner: 'Meera K',
      note: 'Ordered bearings',
    });
    expect(noteBody(MODEL, '2026-12', SPINDLE.id, { note: 'Fitted' })).toEqual({
      period: '2026-12',
      action: 'fixg|Spindle',
      status: 'prog',
      owner: 'Meera K',
      note: 'Fitted',
    });
    expect(noteBody(MODEL, '2026-12', COOLANT.id, { owner: 'Head One' })).toEqual({
      period: '2026-12',
      action: 'fixm|m2|Coolant',
      status: 'open',
      owner: 'Head One',
      note: '',
    });
    expect(noteBody(MODEL, '2026-12', 'no-such-action', { status: 'done' })).toBeNull();
  });

  it('counts the open actions of an action’s lane, of all in it', () => {
    expect(laneTally(MODEL, SPINDLE.id)).toEqual({ open: 2, total: 2 });
    expect(laneTally(MODEL, SAW.id)).toEqual({ open: 0, total: 1 });
    expect(laneTally(MODEL, 'no-such-action')).toBeNull();
  });

  it('finds the actions an owner chip stands for, and none for a person id', () => {
    expect(ownerRows(MODEL, 'owner:Meera K')).toEqual([SPINDLE, SAW]);
    expect(ownerRows(MODEL, 'arjun-v')).toEqual([]);
  });
});

describe('the live Team Focus page (TF-3)', () => {
  it('prints a saved note with its action, and the page control that opens the machines behind the plan', () => {
    const page = text(render(MODEL));
    expect(page).toContain('Ordered bearings');
    expect(page).toContain(DRILL.label);
    expect(text(render({ ...MODEL, drill: undefined }))).not.toContain(DRILL.label);
  });

  it('opens any action of the month in the drawer: its lane hint, how much of its lane is open, and the edit form', () => {
    const out = drawer(encodeURIComponent('decision:fixg|Spindle'));
    expect(out).toMatch(/<aside[^>]*aria-label="Spindle: one of the biggest losses"/);
    const said = text(out);
    expect(said).toContain(realT('analytics.teamFocus.hint.B'));
    expect(said).toContain('2 open of 2');
    for (const word of ['Status', 'Owner', 'Note', 'Save', 'Not started', 'In progress', 'Done'])
      expect(said).toContain(word);
    expect(said).toContain('Not needed');
    expect(out).toContain('Ordered bearings');
    expect(out).toContain('value="Meera K"');
  });

  it('opens an owner from the chip: every action that owner has this month, nothing of anyone else', () => {
    const out = drawer(`person:${encodeURIComponent('owner:Meera K')}`);
    expect(out).toMatch(/<aside[^>]*aria-label="Meera K"/);
    const aside = /<aside[\s\S]*?<\/aside>/.exec(out)?.[0] ?? '';
    const said = text(aside);
    expect(said).toContain('What Meera K owns this month');
    expect(said).toContain(SPINDLE.title);
    expect(said).toContain(SAW.title);
    expect(said).not.toContain(COOLANT.title);
    // the page's own table keeps listing every action of the month, not just this owner's
    expect(text(out.replace(aside, ''))).toContain(COOLANT.title);
  });
});
