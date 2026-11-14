import { describe, expect, it } from 'vitest';
import { raiseBody, startsNow } from './report-state.js';

describe('startsNow', () => {
  it('maintenance may start work while raising', () => {
    expect(startsNow(true, true)).toBe(true);
    expect(startsNow(true, false)).toBe(false);
  });

  it('an operator or any other role never sends start-now, even if the box was ticked', () => {
    expect(startsNow(false, true)).toBe(false);
    expect(startsNow(false, false)).toBe(false);
  });
});

describe('raiseBody', () => {
  it('an operator raise never carries start-now or a reporter', () => {
    const body = raiseBody({ kind: 'stopped', machineId: 'm-1', problem: ' jam ' }, false, true);
    expect(body).toEqual({ kind: 'stopped', machineId: 'm-1', problem: 'jam', startNow: false });
    expect(body).not.toHaveProperty('reportedByPersonId');
  });
});
