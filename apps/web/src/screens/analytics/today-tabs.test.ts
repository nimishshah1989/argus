// @vitest-environment node
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { Waiting } from './ActionCenterPage.js';
import { ChecklistReady } from './DataChecklist.js';
import { TeamFocusPage } from './TeamFocusPage.js';
import { groupFor } from './groups.js';
import { NotReady } from './screen-states.js';

type Figure = FiguresReply['figures'][number];

const html = (element: ReactElement) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, element));
const today = groupFor('today')!;
const rows = (count: number) => Array.from({ length: count }, (_, at) => `Item ${at + 1}`);

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

const ready = (ids: string[]) =>
  html(
    createElement(ChecklistReady, {
      figure: checklist(ids),
      groups: [{ label: 'Maintenance code', rows: rows(25) }],
      group: today,
      title: 'Data checklist',
      lede: '',
    }),
  );

describe('the data checklist', () => {
  it('keeps the way to the tickets behind the gaps when the engine names any, and only then', () => {
    expect(ready(['t1', 't2'])).toContain('/analytics/today?drill=ticket%3At1%2Ct2');
    expect(ready([])).not.toContain('drill=');
  });

  it('shows the first 20 items of a group and folds the rest into a disclosure, all still in the page', () => {
    const page = ready([]);
    const [before, folded] = page.split('<details');
    expect(before).toContain('Item 20');
    expect(before).not.toContain('Item 21');
    expect(folded).toContain('Item 21');
    expect(folded).toContain('Item 25');
    expect(page).toContain('Item 1<');
  });
});

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

  it('keeps the Action Center refusal a status line in the danger ink', () => {
    const page = html(createElement(Waiting, { state: 'ready', refused: true, onRetry: () => {} }));
    expect(page).toContain('role="status"');
    expect(page).toContain('text-bad-ink');
    expect(page).toContain('data-page="refused"');
  });
});
