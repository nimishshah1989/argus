// @vitest-environment node
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { dmy } from './action-center.js';
import { priorDate } from './today-change.js';
import { NotReady } from './screen-states.js';

const html = (element: ReactElement) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, element));

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
