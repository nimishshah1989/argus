import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '../src/kernel/index.js';
import { dayWindow, dayTicketRows } from '../src/modules/tickets/repo/board.js';
import { dayJobRows } from '../src/modules/tickets/repo/history.js';
import { selectTicketPage } from '../src/modules/tickets/repo/list.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '90000000-0000-0000-0000-000000000001';
const person = (n: number): string => `91000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
let db: TestDb;

/** The real repo function gets a Db that answers with the plan of its query instead of its rows. */
async function planOf(run: (tx: Pick<PoolClient, 'query'>) => Promise<unknown>): Promise<string> {
  return withTenant(db.app, TENANT, async (client) => {
    const plans: unknown[] = [];
    await run({
      query: (async (text: string, params?: unknown[]) => {
        const result = await client.query(`EXPLAIN (FORMAT JSON) ${text}`, params);
        plans.push(result.rows);
        return result;
      }) as PoolClient['query'],
    });
    return JSON.stringify(plans);
  });
}

beforeAll(async () => {
  db = await startTestDb();
  const sql = (text: string) => db.admin.query(text, [TENANT]);
  await sql("INSERT INTO tenant (id, slug, name) VALUES ($1, 'indexes', 'Indexes')");
  await sql(`INSERT INTO person (id, tenant_id, name)
    SELECT ('91000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, $1, 'Person ' || i
    FROM generate_series(0, 199) i`);
  // 20,000 closed tickets, one every 26 minutes from 2026-01-01, each with one work stretch and one event.
  await sql(`INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity,
      reported_by_person_id)
    SELECT ('92000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, $1, 'BD-' || lpad(g::text, 6, '0'),
      'stopped', 'closed', 'Synthetic problem', timestamptz '2026-01-01' + g * interval '26 minutes', 'S3',
      ('91000000-0000-0000-0000-' || lpad((g % 200)::text, 12, '0'))::uuid
    FROM generate_series(0, 19999) g`);
  await sql(`INSERT INTO work_segment (tenant_id, ticket_id, person_id, role, started_at, ended_at, end_reason)
    SELECT $1, t.id, t.reported_by_person_id, 'lead', t.reported_at, t.reported_at + interval '30 minutes', 'close'
    FROM ticket t WHERE t.tenant_id = $1`);
  await sql(`INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at, acting_person_id)
    SELECT $1, t.id, 1, 'down', t.reported_at, t.reported_by_person_id FROM ticket t WHERE t.tenant_id = $1`);
  await sql(
    "UPDATE ticket SET closed_at = reported_at + interval '40 minutes' WHERE tenant_id = $1",
  );
  await db.admin.query('ANALYZE ticket, work_segment, ticket_event');
}, 180_000);

afterAll(async () => {
  await db.stop();
});

describe('history indexes', () => {
  it("the day report reaches a person's work through its indexes", async () => {
    const plan = await planOf((tx) =>
      dayJobRows(tx, {
        tenantId: TENANT,
        personId: person(7),
        start: new Date('2026-03-01T00:00:00Z'),
        end: new Date('2026-03-02T00:00:00Z'),
      }),
    );
    expect(plan).toContain('"Index Name":"work_segment_person_idx"');
    expect(plan).toContain('"Index Name":"ticket_event_actor_idx"');
  });

  it("My complaints reaches a reporter's tickets through ticket_reporter_idx", async () => {
    const plan = await planOf((tx) =>
      selectTicketPage(tx, TENANT, {
        statuses: null,
        kinds: null,
        raisedBy: person(7),
        cursor: null,
        limit: 50,
      }),
    );
    expect(plan).toContain('"Index Name":"ticket_reporter_idx"');
  });

  it('a date-range list uses ticket_reported_idx', async () => {
    const plan = await planOf((tx) =>
      selectTicketPage(tx, TENANT, {
        statuses: null,
        kinds: null,
        from: '2026-03-01T00:00:00Z',
        to: '2026-03-08T00:00:00Z',
        cursor: null,
        limit: 50,
      }),
    );
    expect(plan).toContain('"Index Name":"ticket_reported_idx"');
  });

  it('the day board reaches the tickets closed today through ticket_closed_idx', async () => {
    const window = await withTenant(db.app, TENANT, (tx) =>
      dayWindow(tx, 'Asia/Kolkata', new Date('2026-03-05T06:00:00Z')),
    );
    const plan = await planOf((tx) => dayTicketRows(tx, TENANT, window, []));
    expect(plan).toContain('"Index Name":"ticket_closed_idx"');
  });
});
