import { describe, expect, it } from 'vitest';
import type { Ticket } from '../../api.js';
import { openOnMachines } from './use-floor.js';

/**
 * The floor's one-open-ticket-per-machine map (R10). A planned job (`pm`, `inspection`) is not a live breakdown:
 * it must not read "already reported" on the machine or block a breakdown report.
 */

let n = 0;
function ticket(over: Partial<Ticket>): Ticket {
  n += 1;
  return {
    id: `t${n}`,
    ref: `WR-${n}`,
    kind: 'general',
    status: 'open',
    machineId: 'm1',
    raisedChannel: 'pm',
    reportedAt: '2026-11-19T08:00:00Z',
    ...over,
  } as unknown as Ticket;
}

describe('openOnMachines', () => {
  it('keeps a live breakdown and a support ticket on their machines', () => {
    const open = openOnMachines([
      ticket({ machineId: 'm1', kind: 'stopped', raisedChannel: 'floor' }),
      ticket({ machineId: 'm2', kind: 'support', raisedChannel: 'desk' }),
    ]);
    expect([...open.keys()]).toEqual(['m1', 'm2']);
  });

  it('leaves a PM job and an inspection off the machines (R10)', () => {
    const open = openOnMachines([ticket({ machineId: 'm1' })]);
    expect(open.size).toBe(0);
    expect(openOnMachines([ticket({ machineId: 'm2', raisedChannel: 'inspection' })]).size).toBe(0);
  });

  it('a planned job beside a breakdown never hides the breakdown', () => {
    const open = openOnMachines([
      ticket({ machineId: 'm1' }),
      ticket({ machineId: 'm1', kind: 'stopped', raisedChannel: 'floor' }),
    ]);
    expect(open.get('m1')?.kind).toBe('stopped');
  });

  it('a follow-up task has no machine of its own', () => {
    expect(
      openOnMachines([ticket({ machineId: null, kind: 'general', raisedChannel: 'floor' })]).size,
    ).toBe(0);
  });
});
