import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFixture, type Fixture } from './plant-settings-fixture.js';

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
}, 180_000);
afterAll(async () => f.stop());

let keys = 0;
const raise = (payload: object) =>
  f.app.inject({
    method: 'POST',
    url: '/api/v1/tickets',
    headers: {
      host: 'plant-a.localhost',
      'content-type': 'application/json',
      authorization: `Bearer ${f.tokens.operator}`,
      'idempotency-key': `refs-${(keys += 1)}`,
    },
    payload,
  });
const machine = async (code: string) =>
  (await f.call('POST', '/api/v1/machines', f.tokens.head!, { code })).json().id as string;

describe('ticket references', () => {
  it('a work request gets a WR number and a breakdown gets a BD number, each counting on its own', async () => {
    const work = {
      kind: 'general',
      problem: 'Clean the guard',
      location: 'Cell 1',
      workType: 'cleaning',
    };
    const first = await raise(work);
    const second = await raise(work);
    expect(first.statusCode, first.body).toBe(201);
    expect(first.json().ticket.ref).toBe('WR-0001');
    expect(second.json().ticket.ref).toBe('WR-0002');
    const breakdown = await raise({ machineId: await machine('REF-1'), problem: 'Noise' });
    expect(breakdown.json().ticket.ref).toBe('BD-1000');
    const third = await raise(work);
    expect(third.json().ticket.ref).toBe('WR-0003');
    const next = await raise({ machineId: await machine('REF-2'), problem: 'Noise' });
    expect(next.json().ticket.ref).toBe('BD-1001');
  });

  it('a work request that names a machine is still a WR, and a support ticket is a BD', async () => {
    const m = await machine('REF-3');
    const work = await raise({
      kind: 'general',
      machineId: m,
      problem: 'Oil',
      location: 'Cell 1',
      workType: 'oiling',
    });
    expect(work.json().ticket.ref).toMatch(/^WR-\d{4}$/);
    const support = await raise({
      kind: 'support',
      machineId: await machine('REF-4'),
      problem: 'Help',
    });
    expect(support.json().ticket.ref).toMatch(/^BD-\d{4}$/);
  });
});
