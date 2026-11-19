import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PmCalendarItem } from '@uptimo/shared';
import '../../i18n/index.js';
import { confirmMove, JobList, jobKey, jobsOf, landing, MoveForm } from './pm-calendar-move.js';
import { shownMonth } from './pm-calendar-view.js';

const job = (code: string, over: Partial<PmCalendarItem> = {}): PmCalendarItem => ({
  planId: `10000000-0000-4000-8000-${code.replace(/\D/g, '').padStart(12, '1')}`,
  machineId: `20000000-0000-4000-8000-${code.replace(/\D/g, '').padStart(12, '0')}`,
  machineCode: code,
  title: `${code} preventive maintenance`,
  dueOn: '2026-11-20',
  scheduledOn: '2026-11-20',
  toleranceDays: 5,
  ticketId: null,
  status: 'planned',
  movable: true,
  crowded: false,
  suggestedOn: null,
  ...over,
});

const draw = (items: PmCalendarItem[], month = '2026-11') =>
  renderToStaticMarkup(
    h(JobList, {
      items,
      month,
      refusal: null,
      pending: false,
      move: () => Promise.resolve(true),
      announce: () => {},
    }),
  );

describe('the PM jobs list', () => {
  it('gives every movable job a Move to date button named for its machine', () => {
    const page = draw([job('PMC-1'), job('PMC-22', { status: 'open' })]);
    expect(page).toContain('aria-label="Move to date, PMC-1"');
    expect(page).toContain('aria-label="Move to date, PMC-22"');
    expect(page).toContain('Open job');
    expect(page).toContain('Planned');
  });

  it('lists no job the server would refuse to move, and prints nothing for an empty month', () => {
    expect(draw([job('PMC-3', { movable: false })])).toBe('');
    expect(draw([])).toBe('');
  });

  it('lists only the shown month: the grid’s edge days belong to the neighbouring months', () => {
    const items = [job('PMC-1'), job('PMC-22', { scheduledOn: '2026-12-02' })];
    expect(jobsOf(items, '2026-11').map((item) => item.machineCode)).toEqual(['PMC-1']);
    expect(shownMonth({ from: '2026-10-26' })).toBe('2026-11');
    expect(shownMonth({ from: '2026-11-30' })).toBe('2026-12');
  });

  it('keeps a job’s tile when its first move turns the plan into a ticket', () => {
    const before = job('PMC-1');
    const after = { ...before, planId: null, ticketId: '30000000-0000-4000-8000-000000000001' };
    expect(jobKey(after)).toBe(jobKey(before));
  });
});

describe('moving a job from the sheet', () => {
  it('closes the sheet only when the server accepts the day', async () => {
    const close = vi.fn();
    const accept = vi.fn(() => Promise.resolve(true));
    expect(await confirmMove(accept, job('PMC-1'), '2026-11-25', close)).toBe(true);
    expect(accept).toHaveBeenCalledWith(
      expect.objectContaining({ machineCode: 'PMC-1' }),
      '2026-11-25',
    );
    expect(close).toHaveBeenCalledTimes(1);

    const refuse = vi.fn(() => Promise.resolve(false));
    expect(await confirmMove(refuse, job('PMC-1'), '2026-11-29', close)).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('refuses an empty date without asking the server', async () => {
    const move = vi.fn(() => Promise.resolve(true));
    const close = vi.fn();
    expect(await confirmMove(move, job('PMC-1'), '', close)).toBe(false);
    expect(move).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('reads the server’s refusal out as an alert inside the sheet, and prints none before one', () => {
    const form = (refusal: string | null) =>
      renderToStaticMarkup(
        h(MoveForm, {
          item: job('PMC-1'),
          pending: false,
          refusal,
          onMove: () => Promise.resolve(false),
        }),
      );
    expect(form('PM jobs are scheduled Monday to Saturday')).toContain('role="alert"');
    expect(form('PM jobs are scheduled Monday to Saturday')).toContain('Monday to Saturday');
    expect(form(null)).not.toContain('role="alert"');
  });
});

describe('what a landed move does with the sheet', () => {
  it('closes its own sheet and says it afterwards', () => {
    expect(landing('m1', 'm1')).toBe('close');
  });

  it('says it at once when Escape closed the sheet while the move was in flight', () => {
    expect(landing('', 'm1')).toBe('say');
  });

  it('holds it for the close of another job’s sheet, which is open now', () => {
    expect(landing('m2', 'm1')).toBe('hold');
  });
});
