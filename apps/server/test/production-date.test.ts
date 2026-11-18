import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { withTenant } from '@uptimo/db';
import { productionDateAt } from '../src/modules/plant/index.js';
import { A, startFixture, type Fixture } from './plant-settings-fixture.js';

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
  // The plant's two shifts as Cosmos runs them (DOMAIN §5): the day shift, and the night shift across midnight.
  const day = await f.call('PUT', `/api/v1/shifts/${await shiftId('DAY')}`, f.tokens.head!, {
    startsAt: '08:00',
    endsAt: '18:30',
  });
  expect(day.statusCode).toBe(200);
  const night = await f.call('POST', '/api/v1/shifts', f.tokens.head!, {
    code: 'NIGHT',
    name: 'Night',
    startsAt: '18:29',
    endsAt: '05:00',
  });
  expect(night.statusCode).toBe(201);
}, 180_000);
afterAll(async () => f.stop());

async function shiftId(code: string): Promise<string> {
  const rows = (await f.call('GET', '/api/v1/shifts', f.tokens.head!)).json().items;
  return rows.find((s: { code: string }) => s.code === code).id;
}

/** The production date of a moment, the plant being five and a half hours ahead of UTC. */
const dateAt = (utc: string) =>
  withTenant(f.db.app, A, (c) => productionDateAt(c, 'Asia/Kolkata', new Date(utc)));

describe('the production date of a report (DOMAIN §5: a night shift keeps the date it started)', () => {
  it('a stop in the evening part of the night shift is that day', async () => {
    expect(await dateAt('2026-03-10T14:00:00Z')).toBe('2026-03-10'); // 19:30 on 10 March
  });

  it('a stop after midnight in the night shift is still the day the shift started', async () => {
    expect(await dateAt('2026-03-10T18:45:00Z')).toBe('2026-03-10'); // 00:15 on 11 March
    expect(await dateAt('2026-03-10T22:30:00Z')).toBe('2026-03-10'); // 04:00 on 11 March
  });

  it('a stop in the day shift is its own date, and so is one that no shift covers', async () => {
    expect(await dateAt('2026-03-11T05:00:00Z')).toBe('2026-03-11'); // 10:30 on 11 March
    expect(await dateAt('2026-03-10T23:30:00Z')).toBe('2026-03-11'); // 05:00 on 11 March, between the shifts
  });

  it('the one-minute overlap resolves to the later shift, so 18:29 is the night shift of that day', async () => {
    expect(await dateAt('2026-03-10T12:59:00Z')).toBe('2026-03-10'); // 18:29 on 10 March
  });
});

describe('a live close at night files the report under the day the shift started', () => {
  afterEach(() => vi.useRealTimers());

  let keys = 0;
  const post = (token: string, url: string, payload: object) =>
    f.app.inject({
      method: 'POST',
      url,
      headers: {
        host: 'plant-a.localhost',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'idempotency-key': `night-${(keys += 1)}`,
      },
      payload,
    });

  it('closing at 00:15 on 11 March, in the night shift, dates the report 10 March and names the night shift', async () => {
    const machine = (
      await f.call('POST', '/api/v1/machines', f.tokens.head!, { code: 'NIGHT-1' })
    ).json();
    const tech = (
      await f.admin.query("SELECT person_id FROM login WHERE username = 'plant-a-technician'")
    ).rows[0].person_id as string;
    // Only the clock is pinned: the database and the timers keep running.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T18:40:00Z'));
    const raised = await post(f.tokens.operator!, '/api/v1/tickets', {
      machineId: machine.id,
      problem: 'Spindle',
    });
    expect(raised.statusCode, raised.body).toBe(201);
    const id = raised.json().ticket.id as string;
    expect(
      (await post(f.tokens.technician!, `/api/v1/tickets/${id}/start`, { personId: tech }))
        .statusCode,
    ).toBe(200);
    vi.setSystemTime(new Date('2026-03-10T18:45:00Z')); // 00:15 on 11 March at the plant
    const closed = await post(f.tokens.technician!, `/api/v1/tickets/${id}/close`, {
      personId: tech,
      kind: 'report',
      report: { correctiveAction: 'Replaced the belt', failureComponent: 'E' },
    });
    expect(closed.statusCode, closed.body).toBe(200);
    vi.useRealTimers();
    const detail = (await f.call('GET', `/api/v1/tickets/${id}`, f.tokens.head!)).json();
    expect(detail.report).toMatchObject({ date: '2026-03-10', shiftCode: 'NIGHT' });
  });
});
