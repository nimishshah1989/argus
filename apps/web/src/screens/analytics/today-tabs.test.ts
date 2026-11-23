// @vitest-environment node
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { TeamFocusPage } from './TeamFocusPage.js';
import { dmy } from './action-center.js';
import { groupFor } from './groups.js';
import { priorDate } from './today-change.js';
import { NotReady } from './screen-states.js';

type Figure = FiguresReply['figures'][number];

const html = (element: ReactElement) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, element));
const today = groupFor('today')!;

function checklist(ids: string[]): Figure {
  return {
    key: 'data-checklist',
    screen: 'data-checklist',
    owner: 38,
    status: 'ready',
    value: { counts: { bd_code: 25 }, items: [] },
    drill: { type: 'ticket', ids },
  };
}

describe('Team Focus', () => {
  it('keeps a selected drill when the figure is missing or not ready', () => {
    const drill = createElement('p', null, 'DRILL-ROWS');
    for (const figure of [undefined, { ...checklist([]), status: 'held' } as unknown as Figure])
      expect(
        html(
          createElement(TeamFocusPage, {
            figure,
            group: today,
            title: 'Team Focus',
            lede: '',
            drill,
          }),
        ),
      ).toContain('DRILL-ROWS');
  });
});

describe('the Today tabs in a state that is not ready', () => {
  it('shows an empty answer as empty, never as loading', () => {
    const page = html(
      createElement(NotReady, {
        title: 'T',
        state: 'empty',
        emptyText: 'Nothing here',
        onRetry: () => {},
      }),
    );
    expect(page).toContain('data-state="empty"');
    expect(page).toContain('Nothing here');
  });
});

describe('the dates in a lede', () => {
  it('prints the as-of date and the comparison date as dd-mm-yyyy', () => {
    expect(dmy('2026-11-11')).toBe('11-11-2026');
    expect(dmy(priorDate('2026-11-11'))).toBe('12-10-2026');
  });
});
