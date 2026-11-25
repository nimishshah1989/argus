// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { teamFocusFixture as model } from './fixture.js';
import { teamFocusSheets } from './sweep.js';
import { TeamFocusView } from './View.js';

/** Sweep #706 batch A on Team Focus (ADR 0041): its two tables for Excel, and the tiles as a tile set. */
describe('teamFocusSheets', () => {
  const sheets = () => teamFocusSheets(model);

  it('gives the people table, the most open first, numbers as numbers', () => {
    const [people] = sheets();
    const w = model.words.people;
    expect(people!.name).toBe(w.title);
    expect(people!.rows[0]).toEqual([
      w.columns.person,
      w.columns.open,
      w.columns.hours,
      w.columns.done,
      w.columns.load,
    ]);
    expect(people!.rows).toHaveLength(model.people.length + 1);
    const opens = people!.rows.slice(1).map((r) => r[1] as number);
    expect(opens).toEqual([...opens].sort((a, b) => b - a));
    const top = [...model.people].sort((a, b) => b.open - a.open)[0]!;
    expect(people!.rows[1]).toEqual([
      top.role === '' ? top.chip.label : `${top.chip.label} · ${top.role}`,
      top.open,
      top.hours.value,
      top.done,
      top.loadLabel,
    ]);
  });

  it('gives every action of the month, the most hours first', () => {
    const [, actions] = sheets();
    const w = model.words.actions;
    expect(actions!.name).toBe(w.title);
    expect(actions!.rows[0]).toEqual([
      w.columns.action,
      w.columns.owner,
      w.columns.status,
      w.columns.hours,
    ]);
    expect(actions!.rows).toHaveLength(model.actions.length + 1);
    const hours = actions!.rows.slice(1).map((r) => r[3] as number);
    expect(hours).toEqual([...hours].sort((a, b) => b - a));
    const top = [...model.actions].sort((a, b) => b.hours.value - a.hours.value)[0]!;
    expect(actions!.rows[1]![1]).toBe(top.owner?.label ?? w.noOwner);
    expect(actions!.rows[1]![2]).toBe(top.statusLabel);
    expect(actions!.rows[1]![0]).toContain(top.title);
  });
});

describe('the page with the kit pieces', () => {
  const out = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/gallery'] },
      createElement(TeamFocusView, {
        model,
        nav: [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }],
        title: 'Team Focus',
      }),
    ),
  );

  it('draws the key figures as a tile set and offers the Excel', () => {
    expect(out).toContain('class="v2-tile-set"');
    expect(out).toContain('Download Excel');
  });
});
