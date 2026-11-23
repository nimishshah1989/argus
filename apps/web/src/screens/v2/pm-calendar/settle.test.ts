import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TFunction } from 'i18next';
import type { PmCalendarItem, PmCalendarReply, PmRescheduleReply } from '@uptimo/shared';
import { en } from '@uptimo/shared/i18n';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../data/index.js';
import { pmCalendarModel } from './adapter.js';
import { createMover, MoveFailed } from './move.js';
import { leave, settleMove } from './settle.js';
import { SpreadTable } from './tables.js';

const t = ((key: string, values: Record<string, unknown> = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(values[name] ?? ''),
  )) as unknown as TFunction;

const item = (code: string, over: Partial<PmCalendarItem> = {}): PmCalendarItem => ({
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

const jobs = (items: PmCalendarItem[]) =>
  pmCalendarModel(
    {
      calendar: {
        from: '2026-10-26',
        to: '2026-12-06',
        today: '2026-11-11',
        cap: 1,
        items,
      } as PmCalendarReply,
      compliance: undefined,
      asOf: '2026-11-11',
      canMove: true,
    },
    t,
  );

describe('the move form closes only when the server accepts', () => {
  const [one] = jobs([item('PMC-1')]).jobs;

  it('closes the form when the server takes the day, and keeps it open on a refusal', async () => {
    const close = vi.fn();
    expect(await settleMove(() => Promise.resolve(true), one!, '2026-11-25', close)).toBe(true);
    expect(close).toHaveBeenCalledWith(one);
    const refused = vi.fn();
    expect(await settleMove(() => Promise.resolve(false), one!, '2026-11-29', refused)).toBe(false);
    expect(refused).not.toHaveBeenCalled();
  });

  it('never asks the server for an empty date', async () => {
    const move = vi.fn(() => Promise.resolve(true));
    const close = vi.fn();
    expect(await settleMove(move, one!, '', close)).toBe(false);
    expect(move).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});

describe('a move that lands after another job’s form was opened', () => {
  const [a, b] = jobs([item('PMC-1'), item('PMC-2')]).jobs;

  it('closes its own form', () => {
    expect(leave(a!, a!)).toBeNull();
  });

  it('leaves the other job’s form open, with its focus and what was typed in it', () => {
    expect(leave(b!, a!)).toBe(b);
  });

  it('has nothing to close when the form was already closed (Escape while the move was in flight)', () => {
    expect(leave(null, a!)).toBeNull();
  });
});

describe('the Move to button of a crowded day waits while a move is on its way', () => {
  const crowded = jobs([
    item('PMC-1', { crowded: true, suggestedOn: '2026-11-24' }),
    item('PMC-2', { crowded: true, suggestedOn: '2026-11-25' }),
  ]);
  const draw = (busy: boolean) =>
    renderToStaticMarkup(h(SpreadTable, { model: crowded, busy, onMove: () => {} }));
  const buttons = (markup: string) => [...markup.matchAll(/<button[^>]*>Move to \d/g)];

  it('is pressable when nothing is in flight and disabled for every job while one is', () => {
    expect(buttons(draw(false))).toHaveLength(2);
    expect(buttons(draw(false)).every((found) => !found[0].includes('disabled'))).toBe(true);
    expect(buttons(draw(true)).every((found) => found[0].includes('disabled'))).toBe(true);
  });
});

describe('two moves sent close together', () => {
  const words = jobs([]).words.move;
  const request = (code: string, day: string) => ({
    machineId: `m-${code}`,
    planId: null,
    ticketId: null,
    machineCode: code,
    scheduledOn: day,
  });
  const reply = (day: string): PmRescheduleReply => ({
    ticketId: 't',
    ref: 'PM-1',
    scheduledOn: day,
    created: false,
  });

  it('go one after the other, each under its own key, so a landed move is never read as refused', async () => {
    const order: string[] = [];
    const keys: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const mover = createMover(async (body, key) => {
      order.push(`start ${body.machineId}`);
      keys.push(key);
      if (body.machineId === 'm-A') await gate;
      if (body.machineId === 'm-B') throw new TypeError('Failed to fetch');
      order.push(`end ${body.machineId}`);
      return reply(body.scheduledOn);
    }, words);
    const first = mover(request('A', '2026-11-24'));
    const second = mover(request('B', '2026-11-25'));
    await Promise.resolve();
    expect(order).toEqual(['start m-A']);
    release();
    expect(await first).toContain('A moved to');
    await expect(second).rejects.toBeInstanceOf(MoveFailed);
    expect(order).toEqual(['start m-A', 'end m-A', 'start m-B']);
    expect(new Set(keys).size).toBe(2);
  });

  it('keeps going after a refusal: the next move is asked for as usual', async () => {
    let calls = 0;
    const mover = createMover(async (body) => {
      calls += 1;
      if (calls === 1)
        throw new ApiError('conflict', 'That day already has a PM job', 'scheduledOn', 409);
      return reply(body.scheduledOn);
    }, words);
    await expect(mover(request('A', '2026-11-24'))).rejects.toThrow(
      'That day already has a PM job',
    );
    expect(await mover(request('B', '2026-11-25'))).toContain('B moved to');
  });
});
