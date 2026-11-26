import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '../src/kernel/index.js';
import { loadEngineData } from '../src/modules/analytics/load.js';
import { A, M_FREE, startFixture, type Fixture } from './plant-settings-fixture.js';

// OEM-2 (ADR 0051): one OEM cause is one append-only oem_cause ticket event on a closed breakdown. Who decided and
// the plant date are the session's; the analytics loader hands the latest cause per ticket to the engine.

let f: Fixture;
let ticketId = '';
let openTicketId = '';
let supportTicketId = '';

const put = (token: string, body: object, id = ticketId) =>
  f.call('PUT', `/api/v1/tickets/${id}/oem-cause`, token, body);
const plantToday = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

beforeAll(async () => {
  f = await startFixture();
  ticketId = (
    await f.admin.query("SELECT id FROM ticket WHERE tenant_id = $1 AND ref = 'BD-0001'", [A])
  ).rows[0].id as string;
  openTicketId = (
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, severity)
       VALUES ($1, 'BD-0002', 'stopped', 'open', $2, 'Still open', now(), 'S3') RETURNING id`,
      [A, M_FREE],
    )
  ).rows[0].id as string;
  supportTicketId = (
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, severity)
       VALUES ($1, 'BD-0003', 'support', 'closed', $2, 'Not a breakdown', now(), now(), 'S3') RETURNING id`,
      [A, M_FREE],
    )
  ).rows[0].id as string;
}, 120_000);

afterAll(async () => {
  await f?.stop();
});

describe('saving an OEM cause', () => {
  it('saves the cause on a closed breakdown with the acting person and the plant date', async () => {
    const headPerson = (
      await f.admin.query('SELECT person_id FROM login WHERE tenant_id = $1 AND username = $2', [
        A,
        'plant-a-head',
      ])
    ).rows[0].person_id as string;
    const saved = await put(f.tokens.head!, { cause: 'oem' });
    expect(saved.statusCode, saved.body).toBe(201);
    expect(saved.json()).toEqual({
      cause: 'oem',
      decidedBy: headPerson,
      decidedDate: plantToday(),
    });
    const rows = (
      await f.admin.query(
        "SELECT payload FROM ticket_event WHERE tenant_id = $1 AND ticket_id = $2 AND type = 'oem_cause'",
        [A, ticketId],
      )
    ).rows;
    expect(rows).toHaveLength(1);
  });

  it('hands the latest cause per ticket to the engine', async () => {
    const data = await withTenant(f.db.app, A, (tx) => loadEngineData(tx, A));
    expect(data.oemCauses).toEqual([{ ticketId, cause: 'oem' }]);
  });

  it('answers not_found for an unknown ticket', async () => {
    const res = await put(f.tokens.head!, { cause: 'oem' }, randomUUID());
    expect(res.statusCode, res.body).toBe(404);
    expect(res.json().error.code).toBe('not_found');
  });

  it('refuses an open ticket and a ticket that is not a breakdown with 409 not-a-breakdown', async () => {
    for (const id of [openTicketId, supportTicketId]) {
      const res = await put(f.tokens.head!, { cause: 'oem' }, id);
      expect(res.statusCode, res.body).toBe(409);
      expect(res.json().error.code).toBe('conflict');
      expect(res.json().error.message).toBe('not-a-breakdown');
    }
  });
});
