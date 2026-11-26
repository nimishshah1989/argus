import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '../../src/kernel/index.js';
import { loadEngineData } from '../../src/modules/analytics/load.js';
import { OEM_CAUSE_WRITE_REFUSAL } from '../../src/modules/tickets/oem-cause-routes.js';
import { A, startFixture, type Fixture } from '../plant-settings-fixture.js';

/** OEM-2 hidden (ADR 0051): plant isolation, a spoofed author, the role gate, latest-wins and the append-only row. */

let f: Fixture;
let ticketId = '';

const put = (token: string, body: object, id = ticketId) =>
  f.call('PUT', `/api/v1/tickets/${id}/oem-cause`, token, body);

beforeAll(async () => {
  f = await startFixture();
  ticketId = (
    await f.admin.query("SELECT id FROM ticket WHERE tenant_id = $1 AND ref = 'BD-0001'", [A])
  ).rows[0].id as string;
}, 180_000);

afterAll(async () => {
  await f?.stop();
});

describe('OEM cause edges', () => {
  it("answers not_found for another plant's ticket and writes nothing", async () => {
    const res = await put(f.tokens['b-admin']!, { cause: 'oem' });
    expect(res.statusCode, res.body).toBe(404);
    expect(res.json().error.code).toBe('not_found');
    const rows = await f.admin.query("SELECT 1 FROM ticket_event WHERE type = 'oem_cause'");
    expect(rows.rowCount).toBe(0);
  });

  it('refuses a body that names who decided or the date with 422', async () => {
    const by = await put(f.tokens.head!, { cause: 'oem', decidedBy: randomUUID() });
    expect(by.statusCode, by.body).toBe(422);
    expect(by.json().error.code).toBe('validation');
    expect(by.json().error.field).toBe('decidedBy');
    const date = await put(f.tokens.head!, { cause: 'oem', decidedDate: '2000-01-01' });
    expect(date.statusCode, date.body).toBe(422);
    const unknown = await put(f.tokens.head!, { cause: 'maker' });
    expect(unknown.statusCode, unknown.body).toBe(422);
  });

  it('refuses an operator and a technician by name', async () => {
    for (const role of ['operator', 'technician']) {
      const res = await put(f.tokens[role]!, { cause: 'oem' });
      expect(res.statusCode, role).toBe(403);
      expect(res.json().error).toEqual({ code: 'forbidden', message: OEM_CAUSE_WRITE_REFUSAL });
    }
  });

  it('lets a later save win: oem then undecided loads as undecided', async () => {
    expect((await put(f.tokens.head!, { cause: 'oem' })).statusCode).toBe(201);
    expect((await put(f.tokens.supervisor!, { cause: 'undecided' })).statusCode).toBe(201);
    const data = await withTenant(f.db.app, A, (tx) => loadEngineData(tx, A));
    expect(data.oemCauses).toEqual([{ ticketId, cause: 'undecided' }]);
  });

  it('keeps the event append-only: the app role cannot update or delete it', async () => {
    await expect(
      withTenant(f.db.app, A, (tx) =>
        tx.query("UPDATE ticket_event SET payload = '{}'::jsonb WHERE type = 'oem_cause'"),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      withTenant(f.db.app, A, (tx) =>
        tx.query("DELETE FROM ticket_event WHERE type = 'oem_cause'"),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
