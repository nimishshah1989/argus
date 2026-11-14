// Ticket 32: recording a past breakdown is paperwork, not an alarm; a live raise in the same plant is.
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  admin,
  freshMachine,
  past,
  send,
  span,
  startPlant,
  stopPlant,
  tokens,
} from './tickets-past-fixture.js';

beforeAll(startPlant, 120_000);
afterAll(stopPlant);

const notices = async (): Promise<number> =>
  Number((await admin.query('SELECT count(*) FROM notification')).rows[0].count);

it('tells nobody when a past breakdown is recorded, yet tells the maintenance side about a live one', async () => {
  const recorded = await past(tokens.technician as string, span(freshMachine(), '04:00', '05:00'));
  expect(recorded.statusCode).toBe(201);
  expect(await notices()).toBe(0);
  const raised = await send({
    url: '/api/v1/tickets',
    token: tokens.operator as string,
    payload: { machineId: freshMachine(), problem: 'Spindle alarm' },
  });
  expect(raised.statusCode).toBe(201);
  expect(await notices()).toBeGreaterThan(0);
});
