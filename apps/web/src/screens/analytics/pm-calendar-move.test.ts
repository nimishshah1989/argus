import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PmCalendarItem } from '@uptimo/shared';
import '../../i18n/index.js';
import { JobList } from './pm-calendar-move.js';

const job = (code: string, movable: boolean, status: 'planned' | 'open'): PmCalendarItem =>
  ({
    planId: null,
    machineId: `m-${code}`,
    machineCode: code,
    ticketId: null,
    scheduledOn: '2026-11-20',
    movable,
    status,
    crowded: false,
    suggestedOn: null,
  }) as unknown as PmCalendarItem;

const draw = (items: PmCalendarItem[]) =>
  renderToStaticMarkup(
    h(JobList, { items, refusal: null, pending: false, move: () => Promise.resolve(true) }),
  );

describe('the PM jobs list', () => {
  it('gives every movable job a Move to date button named for its machine', () => {
    const page = draw([job('PMC-1', true, 'planned'), job('PMC-2', true, 'open')]);
    expect(page).toContain('aria-label="Move to date, PMC-1"');
    expect(page).toContain('aria-label="Move to date, PMC-2"');
    expect(page).toContain('Open job');
    expect(page).toContain('Planned');
  });

  it('lists no job the server would refuse to move, and prints nothing for an empty month', () => {
    expect(draw([job('PMC-3', false, 'planned')])).toBe('');
    expect(draw([])).toBe('');
  });
});
