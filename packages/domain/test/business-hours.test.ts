import { describe, expect, it } from 'vitest';
import {
  addBusinessMinutes,
  businessMinutesBetween,
  SlaInputError,
  type BusinessCalendar,
} from '../src/index.js';

const t = (iso: string) => new Date(iso);

const weekday: BusinessCalendar = {
  timeZone: 'UTC',
  windows: [{ code: 'day', startMinute: 9 * 60, endMinute: 17 * 60, crossesMidnight: false }],
};

describe('business-hours calculations', () => {
  it('counts only the intersection with a declared shift window', () => {
    expect(
      businessMinutesBetween(t('2026-01-05T08:00:00Z'), t('2026-01-05T10:00:00Z'), weekday),
    ).toBe(60);
  });

  it('adds a target by skipping time outside shift windows', () => {
    expect(addBusinessMinutes(t('2026-01-05T16:30:00Z'), 60, weekday)).toEqual(
      t('2026-01-06T09:30:00Z'),
    );
  });

  it('interprets shift windows in the tenant IANA time zone', () => {
    const india: BusinessCalendar = { ...weekday, timeZone: 'Asia/Kolkata' };
    expect(
      businessMinutesBetween(t('2026-01-05T03:00:00Z'), t('2026-01-05T05:00:00Z'), india),
    ).toBe(90);
  });

  it('uses local wall-clock boundaries across DST changes', () => {
    const nights: BusinessCalendar = {
      timeZone: 'America/New_York',
      windows: [{ code: 'night', startMinute: 0, endMinute: 4 * 60, crossesMidnight: false }],
    };
    expect(
      businessMinutesBetween(t('2026-03-08T00:00:00Z'), t('2026-03-09T00:00:00Z'), nights),
    ).toBe(180);
    expect(
      businessMinutesBetween(t('2026-11-01T00:00:00Z'), t('2026-11-02T00:00:00Z'), nights),
    ).toBe(300);
  });

  it('rejects empty and malformed calendars instead of falling back to 24x7', () => {
    const call = (calendar: BusinessCalendar) => () =>
      businessMinutesBetween(t('2026-01-05T08:00:00Z'), t('2026-01-05T10:00:00Z'), calendar);
    expect(call({ timeZone: 'UTC', windows: [] })).toThrow(SlaInputError);
    expect(call({ timeZone: 'UTC', windows: [] })).toThrow(
      expect.objectContaining({ code: 'invalid_calendar' }),
    );
    expect(
      call({
        timeZone: 'UTC',
        windows: [{ code: 'zero', startMinute: 60, endMinute: 60, crossesMidnight: false }],
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid_calendar' }));
    expect(call({ ...weekday, timeZone: 'Not/A_Zone' })).toThrow(
      expect.objectContaining({ code: 'invalid_calendar' }),
    );
  });

  it('merges adjacent windows and permits a deadline exactly at window end', () => {
    const adjacent: BusinessCalendar = {
      timeZone: 'UTC',
      windows: [
        { code: 'morning', startMinute: 9 * 60, endMinute: 12 * 60, crossesMidnight: false },
        { code: 'afternoon', startMinute: 12 * 60, endMinute: 17 * 60, crossesMidnight: false },
      ],
    };
    expect(
      businessMinutesBetween(t('2026-01-05T11:30:00Z'), t('2026-01-05T12:30:00Z'), adjacent),
    ).toBe(60);
    expect(addBusinessMinutes(t('2026-01-05T16:30:00Z'), 30, adjacent)).toEqual(
      t('2026-01-05T17:00:00Z'),
    );
  });

  it('adds minutes through an overnight window', () => {
    const overnight: BusinessCalendar = {
      timeZone: 'UTC',
      windows: [{ code: 'night', startMinute: 22 * 60, endMinute: 2 * 60, crossesMidnight: true }],
    };
    expect(addBusinessMinutes(t('2026-01-05T21:30:00Z'), 60, overnight)).toEqual(
      t('2026-01-05T23:00:00Z'),
    );
    expect(
      businessMinutesBetween(t('2026-01-05T23:00:00Z'), t('2026-01-06T01:00:00Z'), overnight),
    ).toBe(120);
  });

  it('unions overlapping shift windows instead of double-counting them', () => {
    const overlapping: BusinessCalendar = {
      timeZone: 'UTC',
      windows: [
        { code: '1', startMinute: 8 * 60, endMinute: 18 * 60 + 30, crossesMidnight: false },
        { code: '2', startMinute: 18 * 60 + 29, endMinute: 5 * 60, crossesMidnight: true },
      ],
    };
    expect(
      businessMinutesBetween(t('2026-01-05T18:00:00Z'), t('2026-01-05T19:00:00Z'), overlapping),
    ).toBe(60);
  });
});
