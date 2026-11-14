import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROLES, startFixture, type Fixture } from './plant-settings-fixture.js';

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
}, 180_000);
afterAll(async () => f.stop());

let keys = 0;
const post = (token: string, url: string, payload: object) =>
  f.app.inject({
    method: 'POST',
    url,
    headers: {
      host: 'plant-a.localhost',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': `upgrade-${(keys += 1)}`,
    },
    payload,
  });

/** A support ticket on a machine of its own, raised by the head so every role starts from the same place. */
async function supportTicket(code: string): Promise<string> {
  const machine = (await f.call('POST', '/api/v1/machines', f.tokens.head!, { code })).json();
  const raised = await post(f.tokens.head!, '/api/v1/tickets', {
    kind: 'support',
    machineId: machine.id,
    problem: 'Needs a hand',
  });
  expect(raised.statusCode, raised.body).toBe(201);
  return raised.json().ticket.id as string;
}

describe('upgrading a support ticket to stopped (DOMAIN §2)', () => {
  it.each(ROLES.filter((r) => r !== 'board'))(
    'a %s, who may raise, can upgrade a support ticket on its machine',
    async (role) => {
      const id = await supportTicket(`UP-${role}`);
      const res = await post(f.tokens[role]!, `/api/v1/tickets/${id}/upgrade-kind`, {});
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json().ticket).toMatchObject({ kind: 'stopped', status: 'open' });
    },
  );

  it('a board login, who may not raise, is refused and the ticket stays a support ticket', async () => {
    const id = await supportTicket('UP-board');
    const res = await post(f.tokens.board!, `/api/v1/tickets/${id}/upgrade-kind`, {});
    expect(res.statusCode).toBe(403);
    const ticket = (await f.call('GET', `/api/v1/tickets/${id}`, f.tokens.head!)).json();
    expect(ticket.ticket?.kind ?? ticket.kind).toBe('support');
  });

  it('a ticket that is already a stopped breakdown cannot be upgraded again', async () => {
    const id = await supportTicket('UP-twice');
    expect(
      (await post(f.tokens.operator!, `/api/v1/tickets/${id}/upgrade-kind`, {})).statusCode,
    ).toBe(200);
    expect(
      (await post(f.tokens.operator!, `/api/v1/tickets/${id}/upgrade-kind`, {})).statusCode,
    ).toBe(409);
  });
});
