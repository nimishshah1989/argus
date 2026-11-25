// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NOW, change } from '../settings-audit/fixture.js';
import { auditTakeaway, mayExport } from '../settings-audit/model.js';

describe('S26-5 audit: edges', () => {
  it('never counts a partial window', () => {
    const rows = [
      change('2026-11-25T10:00:00.000Z', 'shift', 'A'),
      change('2026-11-21T10:00:00.000Z', 'shift', 'A'),
    ];
    expect(auditTakeaway(rows, true, NOW)).toBeNull();
  });

  it('counts when more pages exist but the loaded rows already pass the window', () => {
    const rows = [
      change('2026-11-25T10:00:00.000Z', 'shift', 'A'),
      change('2026-11-01T10:00:00.000Z', 'shift', 'A'),
    ];
    expect(auditTakeaway(rows, true, NOW)).toEqual({
      count: 1,
      area: 'shift',
      areaCount: 1,
      by: 'A',
    });
  });

  it('is null with no change in the window', () => {
    expect(auditTakeaway([], false, NOW)).toBeNull();
    expect(
      auditTakeaway([change('2026-11-01T10:00:00.000Z', 'shift', 'A')], false, NOW),
    ).toBeNull();
  });

  it('on a tie the area and the person with the newest row win; rows with no actor are not a person', () => {
    const rows = [
      change('2026-11-25T09:00:00.000Z', 'machine', null),
      change('2026-11-24T09:00:00.000Z', 'shift', 'Old'),
      change('2026-11-23T09:00:00.000Z', 'machine', 'B'),
      change('2026-11-22T09:00:00.000Z', 'shift', 'Old'),
    ];
    expect(auditTakeaway(rows, false, NOW)).toEqual({
      count: 4,
      area: 'machine',
      areaCount: 2,
      by: 'B',
    });
    expect(
      auditTakeaway([change('2026-11-25T09:00:00.000Z', 'grant', null)], false, NOW)?.by,
    ).toBeNull();
  });

  it('refuses export to every role but the admin, and to a login still loading', () => {
    for (const role of ['head', 'plant_head', 'supervisor', 'technician', undefined]) {
      expect(mayExport(role)).toBe(false);
    }
  });
});
