// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MATRIX, policy, reason } from '../desk-settings/fixture-rows.js';
import { criticalityTakeaway, highCells, pausingReasons, slaRows } from '../desk-settings/model.js';

describe('S26-8 desk settings: edges', () => {
  it('is null or empty on empty lists', () => {
    expect(criticalityTakeaway([])).toBeNull();
    expect(slaRows([])).toEqual([]);
    expect(pausingReasons([])).toEqual({ pausing: [], total: 0 });
  });

  it('reads the work-request cells too, in drawing order', () => {
    const matrix = { ...MATRIX, workRequest: 'S1' as const, urgentWorkRequest: 'S1' as const };
    expect(highCells(matrix)).toEqual(['A.stopped', 'workRequest', 'urgentWorkRequest']);
    const none = {
      ...MATRIX,
      default: { ...MATRIX.default, A: { stopped: 'S2' as const, support: 'S2' as const } },
    };
    expect(highCells(none)).toEqual([]);
  });

  it('never reorders the input', () => {
    const input = [policy('S4', 120), policy('S1', 15)];
    slaRows(input);
    expect(input.map((p) => p.severity)).toEqual(['S4', 'S1']);
  });

  it('leaves inactive wait reasons out and orders by sort', () => {
    const r = pausingReasons([
      reason('b', true, 5),
      reason('off', true, 1, false),
      reason('a', true, 2),
    ]);
    expect(r).toMatchObject({ total: 2 });
    expect(r.pausing.map((p) => p.code)).toEqual(['a', 'b']);
  });
});
