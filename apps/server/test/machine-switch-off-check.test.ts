import type { PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import { machineSwitchOffBlocker, setMachineSwitchOffCheck } from '../src/kernel/index.js';

const client = {} as PoolClient;

describe('the switch-off check fails closed', () => {
  it('refuses every switch-off while no check is registered, and hands over to the check once one is', async () => {
    const closed = await machineSwitchOffBlocker(client, 'tenant', 'machine');
    expect(closed).toContain('not registered');
    setMachineSwitchOffCheck(async () => null);
    expect(await machineSwitchOffBlocker(client, 'tenant', 'machine')).toBeNull();
    setMachineSwitchOffCheck(async () => 'busy');
    expect(await machineSwitchOffBlocker(client, 'tenant', 'machine')).toBe('busy');
  });
});
