// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NOW, change } from './fixture-rows.js';
import { auditTakeaway, mayExport } from './model.js';

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
