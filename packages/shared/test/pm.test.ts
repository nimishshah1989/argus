// Ticket 50a: the one next-due rule and the tolerance scale the settings screen, the calendar and the server
// share (R2/R4). The dates are plain calendar days in the plant's zone: a plan anchored at local midnight must
// not read as the day before in UTC.
import { describe, expect, it } from 'vitest';
import {
  pmCalendarQuerySchema,
  pmCalendarReplySchema,
  pmNextDue,
  pmRescheduleSchema,
  pmToleranceDays,
  pmWithinWindow,
} from '../src/pm.js';

/** A plan anchored at 2027-01-02 00:00 in Asia/Kolkata (2027-01-01 18:30 UTC), never done. */
const plan = (over: Record<string, unknown> = {}) => ({
  createdAt: '2027-01-01T18:30:00.000Z',
  lastDoneOn: null,
  intervalDays: 182,
  ...over,
});

describe('pmNextDue (R2)', () => {
  it('adds the interval to the plant-local anchor, not the UTC day', () => {
    expect(pmNextDue(plan(), 'Asia/Kolkata')).toBe('2027-07-03');
    expect(pmNextDue(plan(), 'UTC')).toBe('2027-07-02');
  });

  it('counts from the last done day when the plan has one', () => {
    expect(pmNextDue(plan({ lastDoneOn: '2026-10-19' }), 'Asia/Kolkata')).toBe('2027-04-19');
  });

  it('has no next due without an interval', () => {
    expect(pmNextDue(plan({ intervalDays: null }), 'Asia/Kolkata')).toBeNull();
    expect(pmNextDue(plan({ intervalDays: 0 }), 'Asia/Kolkata')).toBeNull();
  });
});

describe('pmToleranceDays (R4)', () => {
  it('is 15 days for a long or missing interval', () => {
    expect(pmToleranceDays(182)).toBe(15);
    expect(pmToleranceDays(150)).toBe(15);
    expect(pmToleranceDays(3650)).toBe(15);
    expect(pmToleranceDays(null)).toBe(15);
  });

  it('scales down for a short interval, never below one day', () => {
    expect(pmToleranceDays(30)).toBe(2);
    expect(pmToleranceDays(60)).toBe(5);
    expect(pmToleranceDays(100)).toBe(8);
    expect(pmToleranceDays(149)).toBe(12);
    expect(pmToleranceDays(1)).toBe(1);
    expect(pmToleranceDays(15)).toBe(1);
  });
});

describe('pmWithinWindow (R4)', () => {
  it('is inclusive on both tolerance days', () => {
    expect(pmWithinWindow('2026-11-25', '2026-11-10', 15)).toBe(true);
    expect(pmWithinWindow('2026-11-26', '2026-11-10', 15)).toBe(false);
    expect(pmWithinWindow('2026-10-26', '2026-11-10', 15)).toBe(true);
    expect(pmWithinWindow('2026-10-25', '2026-11-10', 15)).toBe(false);
    expect(pmWithinWindow('2026-11-12', '2026-11-10', 2)).toBe(true);
    expect(pmWithinWindow('2026-11-13', '2026-11-10', 2)).toBe(false);
  });
});

describe('the calendar and reschedule contracts', () => {
  it('asks for a real day range, from before to', () => {
    expect(pmCalendarQuerySchema.safeParse({ from: '2026-11-01', to: '2026-11-30' }).success).toBe(
      true,
    );
    expect(pmCalendarQuerySchema.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success).toBe(
      false,
    );
    expect(pmCalendarQuerySchema.safeParse({ from: '2026-11-30', to: '2026-11-01' }).success).toBe(
      false,
    );
    expect(pmCalendarQuerySchema.safeParse({ from: '2026-11-01' }).success).toBe(false);
  });

  it('a calendar reply carries one occurrence per machine and the cap', () => {
    const reply = {
      from: '2026-11-01',
      to: '2026-11-30',
      today: '2026-11-11',
      cap: 1,
      items: [
        {
          planId: null,
          machineId: '10000000-0000-0000-0000-000000000001',
          machineCode: 'VC-1',
          title: 'PM due: VC-1',
          dueOn: '2026-11-10',
          scheduledOn: '2026-11-14',
          toleranceDays: 15,
          ticketId: '10000000-0000-0000-0000-000000000002',
          status: 'open',
          movable: true,
          crowded: false,
          suggestedOn: null,
        },
      ],
    };
    expect(pmCalendarReplySchema.safeParse(reply).success).toBe(true);
    expect(
      pmCalendarReplySchema.safeParse({ ...reply, items: [{ ...reply.items[0]!, extra: 1 }] })
        .success,
    ).toBe(false);
  });

  it('a reschedule body names the machine, the day and optionally the plan and ticket', () => {
    const body = {
      machineId: '10000000-0000-0000-0000-000000000001',
      planId: '10000000-0000-0000-0000-000000000002',
      ticketId: null,
      scheduledOn: '2026-11-14',
    };
    expect(pmRescheduleSchema.safeParse(body).success).toBe(true);
    expect(pmRescheduleSchema.safeParse({ ...body, scheduledOn: '2026-02-30' }).success).toBe(
      false,
    );
    expect(pmRescheduleSchema.safeParse({ machineId: body.machineId }).success).toBe(false);
    expect(pmRescheduleSchema.safeParse({ ...body, reason: 'x' }).success).toBe(false);
  });
});
