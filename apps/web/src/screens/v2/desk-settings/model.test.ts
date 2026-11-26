// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MATRIX, machine, policy, reason } from './fixture-rows.js';
import { criticalityTakeaway, highCells, pausingReasons, slaRows } from './model.js';

describe('S26-8 desk settings model', () => {
  it('counts machines by criticality and those not set', () => {
    const rows = [machine('a', 'A'), machine('b', null), machine('c', 'B'), machine('d', 'B')];
    expect(criticalityTakeaway(rows)).toEqual({ total: 4, unset: 1, A: 1, B: 2, C: 0 });
  });

  it('finds the High cells of the matrix', () => {
    expect(highCells(MATRIX)).toEqual(['A.stopped']);
  });

  it('orders SLA policies from the most urgent', () => {
    const rows = slaRows([policy('S3', 60), policy('S1', 15), policy('S2', 30)]);
    expect(rows.map((p) => p.severity)).toEqual(['S1', 'S2', 'S3']);
  });

  it('lists the wait reasons that pause the restore clock', () => {
    const r = pausingReasons([
      reason('spares', true, 1),
      reason('lunch', false, 2),
      reason('vendor', true, 3),
    ]);
    expect(r.total).toBe(3);
    expect(r.pausing.map((p) => p.code)).toEqual(['spares', 'vendor']);
  });
});
