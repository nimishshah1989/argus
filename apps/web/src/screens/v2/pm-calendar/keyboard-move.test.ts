import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TFunction } from 'i18next';
import type { PmCalendarItem, PmCalendarReply } from '@uptimo/shared';
import { en } from '@uptimo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { pmCalendarModel } from './adapter.js';
import { MovePanel } from './move-panel.js';
import { JobsTable } from './tables.js';

/** The catalogue's English with its `{{name}}` slots filled, so a test reads the words a reader would. */
const t = ((key: string, values: Record<string, unknown> = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(values[name] ?? ''),
  )) as unknown as TFunction;

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

/** A six-week grid that shows November: day 21 of it is in the month shown, as the screen reads it. */
const GRID = { from: '2026-10-26', to: '2026-12-06', today: '2026-11-11', cap: 1 };
const model = (items: PmCalendarItem[], canMove = true) =>
  pmCalendarModel(
    {
      calendar: { ...GRID, items } as PmCalendarReply,
      compliance: undefined,
      asOf: '2026-11-11',
      canMove,
    },
    t,
  );
const table = (items: PmCalendarItem[], canMove = true) =>
  renderToStaticMarkup(h(JobsTable, { model: model(items, canMove), onChoose: () => {} }));

describe('the PM jobs list', () => {
  it('gives every movable job a Move to date button named for its machine', () => {
    const page = table([job('PMC-1'), job('PMC-22', { status: 'open' })]);
    expect(page).toContain('data-job-button="PMC-1"');
    expect(page).toContain('data-job-button="PMC-22"');
    expect(page).toContain('Open job');
    expect(page).toContain('Planned');
  });

  it('offers Move to date on no job the server would refuse to move, and to nobody but a head or an admin', () => {
    expect(table([job('PMC-3', { movable: false })])).not.toContain('data-job-button');
    expect(table([job('PMC-1')], false)).not.toContain('data-job-button');
    // Every job of the month is still listed for a reader, with its state.
    expect(table([job('PMC-3', { movable: false })], false)).toContain('PMC-3');
  });

  it('lists only the shown month: the grid’s edge days belong to the neighbouring months', () => {
    const shown = model([job('PMC-1'), job('PMC-22', { scheduledOn: '2026-12-02' })]);
    expect(shown.month).toBe('2026-11');
    expect(shown.monthJobs.map((one) => one.machine.label)).toEqual(['PMC-1']);
  });

  it('is calm for an empty month: no job and no button', () => {
    expect(model([]).monthJobs).toEqual([]);
    expect(table([])).not.toContain('data-job-button');
  });

  it('keeps a job under its machine when its first move turns the plan into a ticket', () => {
    const before = model([job('PMC-1')]).monthJobs[0]!;
    const ticket = '30000000-0000-4000-8000-000000000001';
    const after = model([job('PMC-1', { planId: null, ticketId: ticket })]).monthJobs[0]!;
    // The write is addressed by handles (the ids), the row and the focus anchor by the machine's own code.
    expect(after.machine).toEqual(before.machine);
    expect(after.handle.ticketId).toBe(ticket);
    expect(before.handle.ticketId).toBeNull();
  });
});

describe('the calendar’s chips', () => {
  it('draws one chip per occurrence, on its own day, with the machine’s code and the job’s own handle in the model', () => {
    const shown = model([
      job('VC-1', { scheduledOn: '2026-11-12' }),
      job('VC-2', {
        planId: null,
        ticketId: '10000000-0000-4000-8000-0000000000b2',
        status: 'open',
        scheduledOn: '2026-11-13',
      }),
    ]);
    expect(shown.events.map((e) => [e.code, e.day, e.open])).toEqual([
      ['VC-1', '2026-11-12', false],
      ['VC-2', '2026-11-13', true],
    ]);
    // A chip and its job are the same occurrence: the chip's id is the job's.
    expect(shown.events.map((e) => e.id)).toEqual(shown.jobs.map((j) => j.id));
  });

  it('lets a movable job be dragged and holds a started one in place', () => {
    const shown = model([job('VC-1'), job('VC-2', { movable: false, status: 'open' })]);
    expect(shown.events.map((e) => e.movable)).toEqual([true, false]);
  });

  it('marks every chip on a crowded day, and counts each occurrence on a day as that day’s load', () => {
    const shown = model([
      job('VC-1', { crowded: true, suggestedOn: '2026-11-14' }),
      job('VC-2', { crowded: true }),
      job('VC-3', { scheduledOn: '2026-11-14' }),
    ]);
    expect(shown.events.map((e) => e.crowded)).toEqual([true, true, false]);
    expect(shown.spread.map((j) => j.machine.label)).toEqual(['VC-1', 'VC-2']);
  });
});

describe('moving a job from the form', () => {
  const draw = (refusal: string | null) =>
    renderToStaticMarkup(
      h(MovePanel, {
        job: model([job('PMC-1')]).monthJobs[0]!,
        words: model([]).words.move,
        busy: false,
        refusal,
        onMove: () => Promise.resolve(false),
        onClose: () => {},
      }),
    );

  it('reads the server’s refusal out as an alert inside the form, and prints none before one', () => {
    expect(draw('PM jobs are scheduled Monday to Saturday')).toContain('role="alert"');
    expect(draw('PM jobs are scheduled Monday to Saturday')).toContain('Monday to Saturday');
    expect(draw(null)).not.toContain('role="alert"');
  });
});
