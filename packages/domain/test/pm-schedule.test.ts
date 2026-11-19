// Ticket 50a: the pure calendar. Each machine gets one occurrence — its effective plan's next due, or the open
// PM ticket that suppresses it — the day's load is counted over every occurrence, and a crowded occurrence gets
// the nearest free working day inside its tolerance, never before the plant's today (R2/R5).
import { describe, expect, it } from 'vitest';
import {
  effectivePmPlan,
  PM_CAP,
  pmCalendar,
  pmSuggestDate,
  type PmCalendarPlan,
  type PmCalendarTicket,
} from '../src/pm-schedule.js';

const plan = (n: number, over: Partial<PmCalendarPlan> = {}): PmCalendarPlan => ({
  planId: `p${n}`,
  machineId: `m${n}`,
  machineCode: `VC-${n}`,
  title: `PM ${n}`,
  createdAt: '2026-05-01T00:00:00.000Z',
  lastDoneOn: '2026-05-01',
  intervalDays: 182,
  ...over,
});

const ticket = (n: number, over: Partial<PmCalendarTicket> = {}): PmCalendarTicket => ({
  ticketId: `t${n}`,
  machineId: `m${n}`,
  machineCode: `VC-${n}`,
  title: `PM due: job ${n}`,
  scheduledOn: '2026-11-20',
  started: false,
  ...over,
});

const range = {
  from: '2026-10-01',
  to: '2026-12-31',
  today: '2026-11-11',
  timeZone: 'Asia/Kolkata',
};

describe('pmCalendar projections (R2)', () => {
  it('shows one planned occurrence at the next due, with the scaled tolerance', () => {
    expect(pmCalendar([plan(1)], [], range)).toEqual({
      cap: PM_CAP,
      items: [
        {
          planId: 'p1',
          machineId: 'm1',
          machineCode: 'VC-1',
          title: 'PM 1',
          dueOn: '2026-10-30',
          scheduledOn: '2026-10-30',
          toleranceDays: 15,
          ticketId: null,
          status: 'planned',
          movable: true,
          crowded: false,
          suggestedOn: null,
        },
      ],
    });
    expect(
      pmCalendar([plan(2, { lastDoneOn: '2026-10-01', intervalDays: 30 })], [], range).items[0],
    ).toMatchObject({ dueOn: '2026-10-31', toleranceDays: 2 });
  });

  it('has no occurrence for a plan with no interval', () => {
    expect(pmCalendar([plan(1, { intervalDays: null })], [], range).items).toEqual([]);
  });

  it('lets an open PM ticket replace the plan occurrence and keep the plan due', () => {
    const { items } = pmCalendar(
      [plan(1, { lastDoneOn: '2026-05-19' })],
      [ticket(1, { scheduledOn: '2026-11-20' })],
      range,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      planId: 'p1',
      machineId: 'm1',
      dueOn: '2026-11-17',
      scheduledOn: '2026-11-20',
      ticketId: 't1',
      status: 'open',
      title: 'PM due: job 1',
      toleranceDays: 15,
      movable: true,
    });
  });

  it('shows a plan-less open ticket with the default window, and refuses to move a started one', () => {
    const { items } = pmCalendar(
      [],
      [ticket(1, { scheduledOn: '2026-11-20' }), ticket(2, { started: true })],
      range,
    );
    expect(items.find((item) => item.machineId === 'm1')).toMatchObject({
      planId: null,
      dueOn: '2026-11-20',
      toleranceDays: 15,
      movable: true,
    });
    expect(items.find((item) => item.machineId === 'm2')).toMatchObject({ movable: false });
  });

  it('does not move a ticket whose plan has no interval', () => {
    const { items } = pmCalendar([plan(1, { intervalDays: null })], [ticket(1)], range);
    expect(items[0]).toMatchObject({ planId: 'p1', movable: false });
  });

  it('keeps one occurrence per machine and filters the reply to the asked range', () => {
    const { items } = pmCalendar(
      [plan(1), plan(1, { planId: 'p1b', title: 'second plan' })],
      [],
      range,
    );
    expect(items).toHaveLength(1);
    expect(items[0]!.planId).toBe('p1');
    expect(pmCalendar([plan(1)], [], { ...range, from: '2026-12-01' }).items).toEqual([]);
  });
});

describe('the load cap and the nearest free day (R5)', () => {
  it('marks both occurrences of a crowded day and suggests the next free working day', () => {
    const { items } = pmCalendar(
      [plan(1, { lastDoneOn: '2026-05-14' }), plan(2, { lastDoneOn: '2026-05-14' })],
      [],
      range,
    );
    expect(items.map((item) => item.scheduledOn)).toEqual(['2026-11-12', '2026-11-12']);
    for (const item of items) {
      expect(item.crowded).toBe(true);
      expect(item.suggestedOn).toBe('2026-11-13');
    }
  });

  it('does not mark a lone occurrence and suggests nothing', () => {
    const { items } = pmCalendar([plan(1, { lastDoneOn: '2026-05-14' })], [], range);
    expect(items[0]).toMatchObject({ crowded: false, suggestedOn: null });
  });

  it('skips Sunday when it suggests a day', () => {
    const { items } = pmCalendar(
      [plan(1, { lastDoneOn: '2026-05-16' }), plan(2, { lastDoneOn: '2026-05-16' })],
      [],
      range,
    );
    // 2026-11-14 is a Saturday; 15 is a Sunday, so the first free day is Monday the 16th.
    expect(items[0]!.scheduledOn).toBe('2026-11-14');
    expect(items[0]!.suggestedOn).toBe('2026-11-16');
  });

  it('never suggests a day before the plant today', () => {
    const { items } = pmCalendar(
      [plan(1, { lastDoneOn: '2026-05-05' }), plan(2, { lastDoneOn: '2026-05-05' })],
      [],
      range,
    );
    expect(items[0]!.scheduledOn).toBe('2026-11-03');
    expect(items[0]!.suggestedOn).toBe('2026-11-11');
  });

  it('suggests nothing when the whole window is before today', () => {
    const { items } = pmCalendar(
      [plan(1, { lastDoneOn: '2026-05-14' }), plan(2, { lastDoneOn: '2026-05-14' })],
      [],
      { ...range, today: '2026-11-28' },
    );
    expect(items[0]!.suggestedOn).toBeNull();
  });

  it('does not suggest a day for a crowded ticket that has started', () => {
    const { items } = pmCalendar(
      [],
      [
        ticket(1, { scheduledOn: '2026-11-12', started: true }),
        ticket(2, { scheduledOn: '2026-11-12' }),
      ],
      range,
    );
    expect(items.find((item) => item.machineId === 'm1')).toMatchObject({
      crowded: true,
      suggestedOn: null,
    });
    expect(items.find((item) => item.machineId === 'm2')!.suggestedOn).toBe('2026-11-13');
  });

  it('searches forward, then backward, and stays inside the tolerance', () => {
    const occupied = new Set(['2026-11-13', '2026-11-14']);
    expect(
      pmSuggestDate({
        scheduledOn: '2026-11-12',
        dueOn: '2026-11-12',
        toleranceDays: 2,
        today: '2026-11-01',
        occupied,
      }),
    ).toBe('2026-11-11');
    expect(
      pmSuggestDate({
        scheduledOn: '2026-11-12',
        dueOn: '2026-11-12',
        toleranceDays: 1,
        today: '2026-11-01',
        occupied: new Set(['2026-11-11', '2026-11-13']),
      }),
    ).toBeNull();
  });
});

describe('effectivePmPlan (R3)', () => {
  const machine = (over: Record<string, unknown> = {}) => ({
    id: 'm1',
    category: 'VMC',
    status: 'active',
    ...over,
  });
  const base = {
    machineId: 'm1',
    category: 'VMC',
    active: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('prefers the machine plan over its category plan, newest first', () => {
    const category = { ...base, id: 'c1', machineId: null };
    const own = { ...base, id: 'own', machineId: 'm1' };
    expect(effectivePmPlan([category, own], machine())?.id).toBe('own');
    expect(effectivePmPlan([category], machine())?.id).toBe('c1');
  });

  it('ignores a switched-off plan and picks the newest category plan', () => {
    const old = { ...base, id: 'c1', machineId: null, updatedAt: '2026-01-01T00:00:00.000Z' };
    const newer = { ...base, id: 'c2', machineId: null, updatedAt: '2026-02-01T00:00:00.000Z' };
    const off = { ...base, id: 'own', machineId: 'm1', active: false };
    expect(effectivePmPlan([old, newer, off], machine())?.id).toBe('c2');
  });

  it('resolves nothing for a scrapped machine or a category nobody covers', () => {
    expect(
      effectivePmPlan([{ ...base, id: 'own', machineId: 'm1' }], machine({ status: 'scrapped' })),
    ).toBeNull();
    expect(
      effectivePmPlan([{ ...base, id: 'c1', machineId: null, category: 'HMC' }], machine()),
    ).toBeNull();
  });
});
