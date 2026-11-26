// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NOW, change } from './fixture-rows.js';
import { auditTakeaway, mayExport, searchText } from './model.js';

describe('S26-5 audit model', () => {
  it('names the area with most changes in the last 7 days, and who made most of them', () => {
    const rows = [
      change('2026-11-25T10:00:00.000Z', 'shift', 'Admin A'),
      change('2026-11-24T10:00:00.000Z', 'analytics_profile', 'Head A'),
      change('2026-11-23T10:00:00.000Z', 'analytics_profile', 'Head A'),
      change('2026-11-22T10:00:00.000Z', 'analytics_profile', 'Admin A'),
      change('2026-11-10T10:00:00.000Z', 'shift', 'Admin A'),
    ];
    expect(auditTakeaway(rows, false, NOW)).toEqual({
      count: 4,
      area: 'analytics_profile',
      areaCount: 3,
      by: 'Head A',
    });
  });

  it('lets only the admin export', () => {
    expect(mayExport('admin')).toBe(true);
    expect(mayExport('head')).toBe(false);
  });
});

describe('S26-5 fixes (ticket 842)', () => {
  it('counts a change stamped slightly after the browser clock (server clock ahead)', () => {
    const ahead = change(new Date(NOW.getTime() + 5 * 60_000).toISOString(), 'shift', 'Admin A');
    expect(auditTakeaway([ahead], false, NOW)?.count).toBe(1);
  });

  it('searches a change with no reason without the word "undefined"', () => {
    expect(searchText('Update', 'Shifts', 'Admin A', undefined)).not.toContain('undefined');
    expect(searchText('Update', 'Shifts', 'Admin A', 'night cover')).toContain('night cover');
  });
});
