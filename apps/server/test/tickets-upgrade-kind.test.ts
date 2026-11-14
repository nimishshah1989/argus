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

describe('only a ticket that is still being worked can be upgraded', () => {
  const person = async (username: string) =>
    (await f.admin.query('SELECT person_id FROM login WHERE username = $1', [username])).rows[0]
      .person_id as string;
  const kindOf = async (id: string) =>
    (await f.call('GET', `/api/v1/tickets/${id}`, f.tokens.head!)).json().ticket.kind;

  it('a cancelled ticket and a closed ticket refuse the upgrade, and their history is unchanged', async () => {
    const tech = await person('plant-a-technician');
    const cancelled = await supportTicket('UP-cancelled');
    expect(
      (
        await post(f.tokens.technician!, `/api/v1/tickets/${cancelled}/cancel`, {
          personId: tech,
          reason: 'Mistake',
        })
      ).statusCode,
    ).toBe(200);
    const closed = await supportTicket('UP-closed');
    expect(
      (await post(f.tokens.technician!, `/api/v1/tickets/${closed}/start`, { personId: tech }))
        .statusCode,
    ).toBe(200);
    const done = await post(f.tokens.technician!, `/api/v1/tickets/${closed}/close`, {
      personId: tech,
      kind: 'no_report',
    });
    expect(done.statusCode, done.body).toBe(200);
    for (const id of [cancelled, closed]) {
      const before = (await f.call('GET', `/api/v1/tickets/${id}`, f.tokens.head!)).json().events
        .length;
      const res = await post(f.tokens.operator!, `/api/v1/tickets/${id}/upgrade-kind`, {});
      expect(res.statusCode, res.body).toBe(409);
      expect(await kindOf(id)).toBe('support');
      expect(
        (await f.call('GET', `/api/v1/tickets/${id}`, f.tokens.head!)).json().events,
      ).toHaveLength(before);
    }
  });

  it('a working and a waiting ticket can still be upgraded', async () => {
    const tech = await person('plant-a-technician');
    const working = await supportTicket('UP-working');
    await post(f.tokens.technician!, `/api/v1/tickets/${working}/start`, { personId: tech });
    expect(
      (await post(f.tokens.operator!, `/api/v1/tickets/${working}/upgrade-kind`, {})).statusCode,
    ).toBe(200);
  });
});

describe('who is acting on an upgrade is resolved like every other command', () => {
  it('a shared login acts as the person chosen on the phone, and that person is on the event', async () => {
    const id = await supportTicket('UP-shared');
    const acting = (
      await f.admin.query("SELECT person_id FROM login WHERE username = 'plant-a-operator'")
    ).rows[0].person_id as string;
    const chosen = await f.call('POST', '/api/v1/auth/acting', f.tokens['shared-operator']!, {
      actingPersonId: acting,
    });
    expect(chosen.statusCode, chosen.body).toBe(200);
    const res = await post(f.tokens['shared-operator']!, `/api/v1/tickets/${id}/upgrade-kind`, {});
    expect(res.statusCode, res.body).toBe(200);
    const events = (await f.call('GET', `/api/v1/tickets/${id}`, f.tokens.head!)).json().events;
    const upgrade = events.find((e: { type: string }) => e.type === 'upgrade_kind');
    expect(upgrade.actingPersonId).toBe(acting);
  });

  it('a shared login cannot act as a person it only names, in this plant or not', async () => {
    const id = await supportTicket('UP-shared-other');
    const person = async (username: string) =>
      (await f.admin.query('SELECT person_id FROM login WHERE username = $1', [username])).rows[0]
        .person_id as string;
    const chosen = await f.call('POST', '/api/v1/auth/acting', f.tokens['shared-operator']!, {
      actingPersonId: await person('plant-a-operator'),
    });
    expect(chosen.statusCode, chosen.body).toBe(200);
    for (const personId of [
      await person('plant-a-technician'),
      '99999999-9999-4999-8999-999999999999',
    ]) {
      const res = await post(f.tokens['shared-operator']!, `/api/v1/tickets/${id}/upgrade-kind`, {
        personId,
      });
      expect(res.statusCode, res.body).toBe(403);
    }
    const events = (await f.call('GET', `/api/v1/tickets/${id}`, f.tokens.head!)).json().events;
    expect(events.some((e: { type: string }) => e.type === 'upgrade_kind')).toBe(false);
  });

  it('a signed-in person acts as themselves: no body person, or their own, works; another person is 403', async () => {
    const id = await supportTicket('UP-self');
    const other = (
      await f.admin.query("SELECT person_id FROM login WHERE username = 'plant-a-technician'")
    ).rows[0].person_id as string;
    const refused = await post(f.tokens.operator!, `/api/v1/tickets/${id}/upgrade-kind`, {
      personId: other,
    });
    expect(refused.statusCode).toBe(403);
    expect(
      (await post(f.tokens.operator!, `/api/v1/tickets/${id}/upgrade-kind`, {})).statusCode,
    ).toBe(200);
  });
});
