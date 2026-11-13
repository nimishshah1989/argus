import { Pool } from 'pg';
import { expect, test } from './test.js';
import { TENANT, signIn } from './fixtures.js';

/** More closed jobs in the last 30 days than one page of 200 holds (ticket 16, goal 1). */
const ROWS = 230;

test.beforeAll(async () => {
  const pool = new Pool({ connectionString: process.env.E2E_ADMIN_DATABASE_URL, max: 1 });
  try {
    await pool.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, problem, reported_at, severity, raised_channel,
         started_at, lead_person_id, closed_at, close_kind)
       SELECT $1, 'PG-' || n, 'general', 'closed', 'Paging row ' || n,
         now() - interval '3 days', 'S4', 'backfill', now() - interval '3 days',
         (SELECT id FROM person WHERE tenant_id = $1 ORDER BY id LIMIT 1),
         now() - interval '2 days' + n * interval '1 minute', 'done'
       FROM generate_series(1, $2::int) AS n`,
      [TENANT.id, ROWS],
    );
  } finally {
    await pool.end();
  }
});

test('Team lists every closed job of the last 30 days past 200 rows', async ({ page }) => {
  await signIn(page, 'asha');
  await page.goto('/desk');
  await page.getByRole('button', { name: 'Team', exact: true }).click();
  const closed = page.getByRole('region', { name: 'Closed, last 30 days' });
  await expect.poll(() => closed.getByRole('link', { name: /^PG-/ }).count()).toBe(ROWS);
});
