import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { withTenant } from '@uptimo/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadDayReport } from '../src/modules/reports/day-report.js';
import { startTestDb, type TestDb } from './harness.js';

/**
 * A person's minutes on a ticket are one number: the ticket view, the list and the day report agree. The stretches are
 * chosen so that adding the seconds first (21) and rounding each stretch first (20) differ, which is what a second
 * calculation of the same number would get wrong.
 */
const TENANT = randomUUID();
const PASSWORD = 'correct-horse-battery';
let db: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;
let token = '';
let asha = '';
let keys = 0;
const tickets: string[] = [];

type Res = Awaited<ReturnType<typeof app.inject>>;
const call = (method: 'POST' | 'GET', url: string, payload?: object): Promise<Res> => {
  keys += 1;
  return app.inject({
    method,
    url,
    headers: {
      host: 'cosmos.localhost',
      authorization: `Bearer ${token}`,
      ...(method === 'POST'
        ? { 'content-type': 'application/json', 'idempotency-key': `agree-${keys}` }
        : {}),
    },
    ...(payload ? { payload } : {}),
  });
};
const at = (iso: string) => vi.setSystemTime(new Date(iso));

beforeAll(async () => {
  db = await startTestDb();
  asha = randomUUID();
  const segment = randomUUID();
  const machines = [randomUUID(), randomUUID()];
  await db.admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')", [
    TENANT,
  ]);
  await db.admin.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0)",
    [segment, TENANT],
  );
  for (const [i, id] of machines.entries())
    await db.admin.query(
      "INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES ($1, $2, $3, $4, 'VMC', 'C')",
      [id, TENANT, `M-${i}`, segment],
    );
  await db.admin.query(
    "INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $2, 'Asha', 'maintenance', 'Technician')",
    [asha, TENANT],
  );
  await db.admin.query(
    "INSERT INTO list_item (tenant_id, list, code, label, pauses_sla) VALUES ($1, 'wait_reason', 'spare', 'Waiting for spare', false)",
    [TENANT],
  );
  await db.admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [TENANT],
  );
  await db.admin.query(
    "INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, 'asha', $3, 'technician', false)",
    [
      TENANT,
      asha,
      await hash(PASSWORD, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 }),
    ],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
    payload: { username: 'asha', password: PASSWORD },
  });
  token = login.json().token as string;

  vi.useFakeTimers({ toFake: ['Date'] });
  // 10 Nov 2026, Kolkata day shift (08:00-18:30 = 02:30-13:00 UTC). Ticket one: two stretches of 10 min 29 s.
  const steps: Array<[string, string, object?]> = [
    ['2026-11-10T04:29:00Z', 'raise'],
    ['2026-11-10T04:30:00Z', 'start'],
    ['2026-11-10T04:40:29Z', 'pause'],
    ['2026-11-10T05:30:00Z', 'resume'],
    ['2026-11-10T05:40:29Z', 'pause'],
  ];
  for (const [i, machineId] of machines.entries()) {
    const shift = i * 3600_000; // ticket two runs an hour later, one stretch of 7 min 31 s
    let id = '';
    for (const [when, what] of i === 0 ? steps : steps.slice(0, 2)) {
      at(new Date(Date.parse(when) + shift).toISOString());
      if (what === 'raise') {
        id = (await call('POST', '/api/v1/tickets', { machineId, problem: 'Alarm' })).json().ticket
          .id;
        tickets.push(id);
      } else {
        const extra = what === 'pause' ? { reasonCode: 'spare' } : {};
        const res = await call('POST', `/api/v1/tickets/${id}/${what}`, {
          personId: asha,
          ...extra,
        });
        expect(res.statusCode).toBe(200);
      }
    }
    if (i === 1) {
      at(new Date(Date.parse('2026-11-10T04:37:31Z') + shift).toISOString());
      await call('POST', `/api/v1/tickets/${id}/pause`, { personId: asha, reasonCode: 'spare' });
    }
  }
  at('2026-11-10T12:00:00Z');
}, 240_000);

afterAll(async () => {
  vi.useRealTimers();
  await app.close();
  await db.stop();
});

describe("a person's minutes on a ticket", () => {
  it('are the same number on the ticket, the list and the day report, and are the rounded stretches added', async () => {
    const viaTicket: number[] = [];
    for (const id of tickets) {
      const detail = await call('GET', `/api/v1/tickets/${id}`);
      viaTicket.push(detail.json().ticket.figures.perPerson[asha]);
    }
    const listed = (await call('GET', `/api/v1/tickets?personId=${asha}`)).json().items as Array<{
      id: string;
      figures: { perPerson: Record<string, number> };
    }>;
    const viaList = tickets.map((id) => listed.find((t) => t.id === id)?.figures.perPerson[asha]);
    // No shift chosen: the whole calendar day (the plant's own shift windows are proven in reports-real.test.ts).
    const loaded = await withTenant(db.app, TENANT, (client) =>
      loadDayReport(client, { tenantId: TENANT, personId: asha, date: '2026-11-10', shift: null }),
    );
    const report = loaded === 'no-shift' ? null : loaded;
    const viaReport = tickets.map((id) => report?.jobs.find((j) => j.ticketId === id)?.minutes);
    expect(viaTicket).toEqual([20, 8]);
    expect(viaList).toEqual(viaTicket);
    expect(viaReport).toEqual(viaTicket);
    expect(report?.totalMinutes).toBe(28);
  });
});
