import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { startTestDb, type TestDb } from './harness.js';

const A = '10000000-0000-0000-0000-000000000001';
const B = '20000000-0000-0000-0000-000000000001';
const TICKET_A = '10000000-0000-0000-0000-000000000010';
const TICKET_B = '20000000-0000-0000-0000-000000000010';

let db: TestDb;

beforeAll(async () => {
  db = await startTestDb();
  await db.admin.query(
    "INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos'), ($2, 'plant-two', 'Plant Two')",
    [A, B],
  );
  await db.admin.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity) VALUES
     ($1, $2, 'BD-A', 'stopped', 'open', 'Tenant A', now(), 'S3'),
     ($3, $4, 'BD-B', 'stopped', 'open', 'Tenant B', now(), 'S3')`,
    [TICKET_A, A, TICKET_B, B],
  );
}, 120_000);

afterAll(async () => {
  await db.stop();
});

describe('RLS on the app_api path', () => {
  it('connects as app_api with no RLS bypass', async () => {
    const row = (
      await db.app.query(
        'SELECT current_user, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user',
      )
    ).rows[0];
    expect(row.current_user).toBe('app_api');
    expect(row.rolbypassrls).toBe(false);
    expect(row.rolsuper).toBe(false);
  });

  it('returns zero rows without a tenant context', async () => {
    const row = (await db.app.query('SELECT count(*)::int AS n FROM ticket')).rows[0];
    expect(row.n).toBe(0);
  });

  it('returns only the current tenant rows inside withTenant', async () => {
    const a = await withTenant(db.app, A, (client) =>
      client.query('SELECT count(*)::int AS n FROM ticket'),
    );
    expect(a.rows[0].n).toBe(1);
    const b = await withTenant(db.app, B, (client) =>
      client.query('SELECT count(*)::int AS n FROM ticket'),
    );
    expect(b.rows[0].n).toBe(1);
  });

  it('hides another tenant row even with an explicit id filter', async () => {
    const other = await withTenant(db.app, A, (client) =>
      client.query('SELECT * FROM ticket WHERE id = $1', [TICKET_B]),
    );
    expect(other.rows).toHaveLength(0);
    const own = await withTenant(db.app, A, (client) =>
      client.query('SELECT * FROM ticket WHERE id = $1', [TICKET_A]),
    );
    expect(own.rows).toHaveLength(1);
  });
});
