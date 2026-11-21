import { describe, expect, it } from 'vitest';
import type { PmCalendarItem } from '@uptimo/shared';
import {
  loadOf,
  moveKeys,
  monthRange,
  rateText,
  readMachineTasks,
  readPmCompliance,
  type TaskTicket,
} from './pm-calendar-view.js';

/**
 * Ticket 50c: the PM page's mapping, before any paint. The calendar's events, the day's load, the two compliance
 * tiles and the machine page's task split are pure here, so a missing date or a null denominator is provable
 * without a browser.
 */

const item = (over: Partial<PmCalendarItem> = {}): PmCalendarItem => ({
  planId: '10000000-0000-4000-8000-000000000001',
  machineId: '10000000-0000-4000-8000-000000000011',
  machineCode: 'VC-1',
  title: 'VC-1 preventive maintenance',
  dueOn: '2026-11-12',
  scheduledOn: '2026-11-12',
  toleranceDays: 15,
  ticketId: null,
  status: 'planned',
  movable: true,
  crowded: false,
  suggestedOn: null,
  ...over,
});

const ticket = (over: Partial<TaskTicket> = {}): TaskTicket => ({
  id: '10000000-0000-4000-8000-0000000000a1',
  ref: 'BD-150',
  problem: 'Spindle alarm',
  status: 'open',
  raisedChannel: 'floor',
  taskExpectedOn: null,
  reportedAt: '2026-11-18T04:00:00.000Z',
  ...over,
});

describe('the day load and the month range (R2)', () => {
  it('counts every occurrence on a day as that day’s load, crowded or not', () => {
    const items = [
      item(),
      item({ machineCode: 'VC-2', crowded: true, suggestedOn: '2026-11-14' }),
      item({ machineCode: 'VC-3', scheduledOn: '2026-11-14' }),
    ];
    expect([...loadOf(items).entries()]).toEqual([
      ['2026-11-12', 2],
      ['2026-11-14', 1],
    ]);
  });

  it('turns the plant’s day into its month’s inclusive API range', () => {
    expect(monthRange('2026-11-19')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthRange('2026-02-01')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('the compliance tiles (R6/R7/R16)', () => {
  const value = {
    from: '2026-01-01',
    to: '2026-11-11',
    pm: {
      eligible: 8,
      onTime: 2,
      early: 1,
      late: 2,
      overdue: 2,
      cancelled: 1,
      pending: 1,
      pct: 25,
    },
    schedule: { eligible: 11, done: 3, missed: 8, pending: 0, pct: 27.3 },
  };

  it('reads both rates and the counts behind them, one decimal and a per cent', () => {
    const view = readPmCompliance(value);
    expect(view).not.toBeNull();
    expect(view).toMatchObject({
      from: '2026-01-01',
      to: '2026-11-11',
      empty: false,
      pm: { pct: 25, counts: { eligible: 8, onTime: 2, cancelled: 1 } },
      schedule: { pct: 27.3, counts: { eligible: 11, done: 3, missed: 8 } },
    });
    expect(rateText(25)).toBe('25.0 %');
    expect(rateText(27.3)).toBe('27.3 %');
  });

  it('prints a dash, never 0 %, when a denominator is empty, and says so when both are', () => {
    const empty = readPmCompliance({
      from: '2026-01-01',
      to: '2026-11-11',
      pm: { eligible: 0, onTime: 0, pct: null },
      schedule: { eligible: 0, done: 0, missed: 0, pending: 0, pct: null },
    });
    expect(empty?.empty).toBe(true);
    expect(empty?.pm.pct).toBeNull();
    expect(rateText(null)).toBe('—');
  });

  it('reads nothing from a value that is not the figure’s shape', () => {
    expect(readPmCompliance(null)).toBeNull();
    expect(readPmCompliance({ from: '2026-01-01' })).toBeNull();
    expect(readPmCompliance('25 %')).toBeNull();
  });
});

describe('the machine page’s task split (R9)', () => {
  it('splits open tasks from PM jobs with the shared planned predicate', () => {
    const view = readMachineTasks(
      [
        ticket(),
        ticket({
          id: '10000000-0000-4000-8000-0000000000b2',
          ref: 'WR-PM1',
          problem: 'PM due: VC-1 preventive maintenance',
          raisedChannel: 'pm',
          taskExpectedOn: '2026-11-12',
        }),
      ],
      { today: '2026-11-19' },
    );
    expect(view.open.map((row) => row.ref)).toEqual(['BD-150']);
    expect(view.pm).toHaveLength(1);
    expect(view.pm[0]).toMatchObject({
      ref: 'WR-PM1',
      scheduledOn: '2026-11-12',
      overdue: true,
    });
  });

  it('falls back to the plant day it was reported and sorts PM jobs by their scheduled day', () => {
    const view = readMachineTasks(
      [
        ticket({
          id: '10000000-0000-4000-8000-0000000000b2',
          ref: 'WR-PM2',
          raisedChannel: 'pm',
          taskExpectedOn: null,
          reportedAt: '2026-11-18T20:00:00.000Z',
        }),
        ticket({
          id: '10000000-0000-4000-8000-0000000000b3',
          ref: 'WR-PM3',
          raisedChannel: 'inspection',
          taskExpectedOn: '2026-11-10',
        }),
      ],
      { today: '2026-11-19', timeZone: 'Asia/Kolkata' },
    );
    // 20:00 UTC is already the 19th in the plant's zone: the fallback is the plant day, not the UTC one.
    expect(view.pm.map((row) => row.ref)).toEqual(['WR-PM3', 'WR-PM2']);
    expect(view.pm[0]).toMatchObject({ scheduledOn: '2026-11-10', overdue: true });
    expect(view.pm[1]).toMatchObject({ scheduledOn: '2026-11-19', overdue: false });
  });

  it('never marks an open (non-PM) task overdue, and keeps a future PM job on time', () => {
    const view = readMachineTasks(
      [
        ticket({ reportedAt: '2026-10-01T04:00:00.000Z' }),
        ticket({ ref: 'WR-PM4', raisedChannel: 'pm', taskExpectedOn: '2026-11-25' }),
      ],
      { today: '2026-11-19' },
    );
    expect(view.open[0]?.overdue).toBe(false);
    expect(view.pm[0]?.overdue).toBe(false);
  });
});

describe('one idempotency key per move attempt', () => {
  const body = { machineId: 'm1', planId: 'p1', ticketId: null, scheduledOn: '2026-11-20' };

  it('reuses the key for a double tap and a retry of the same move', () => {
    let made = 0;
    const keys = moveKeys(() => `key-${++made}`);
    expect(keys.keyFor(body)).toBe('key-1');
    expect(keys.keyFor({ ...body })).toBe('key-1');
  });

  it('takes a new key for another day, and once the server has answered', () => {
    let made = 0;
    const keys = moveKeys(() => `key-${++made}`);
    expect(keys.keyFor(body)).toBe('key-1');
    expect(keys.keyFor({ ...body, scheduledOn: '2026-11-21' })).toBe('key-2');
    keys.settled();
    expect(keys.keyFor({ ...body, scheduledOn: '2026-11-21' })).toBe('key-3');
  });
});
