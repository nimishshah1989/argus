import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { expect, test } from './test.js';
import { TENANT, WORKER, signIn } from './fixtures.js';

/**
 * Background jobs (MILESTONES 78b): a job that failed shows on the admin's screen with its error, a new failure
 * appears without a reload, Retry runs it once and it leaves the list, and nobody but the admin opens the screen.
 * The jobs are planted in pg-boss's own table on a queue no worker listens to, so a retry cannot fail again.
 */
const QUEUE = `e2e.plant${WORKER}`;
const KIND = `E2e plant${WORKER}`;

async function withPool<T>(work: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.E2E_ADMIN_DATABASE_URL, max: 1 });
  try {
    return await work(pool);
  } finally {
    await pool.end();
  }
}

/** One failed job of this worker's plant, with a message no other test shares. */
async function plantFailure(): Promise<{ id: string; error: string }> {
  const error = `planted failure ${randomUUID().slice(0, 8)}: the spindle file is missing`;
  const id = await withPool(async (pool) => {
    await pool.query(
      `SELECT pgboss.create_queue($1, '{"policy":"standard"}'::jsonb)
        WHERE NOT EXISTS (SELECT 1 FROM pgboss.queue WHERE name = $1)`,
      [QUEUE],
    );
    const { rows } = await pool.query(
      `INSERT INTO pgboss.job (name, data, state, retry_limit, retry_count, output, completed_on)
       VALUES ($1, $2, 'failed', 0, 1, $3, now()) RETURNING id`,
      [QUEUE, { tenantId: TENANT.id }, { message: error }],
    );
    return rows[0].id as string;
  });
  return { id, error };
}

const stateOf = (id: string): Promise<string> =>
  withPool(async (pool) => {
    const { rows } = await pool.query('SELECT state FROM pgboss.job WHERE id = $1', [id]);
    return rows[0].state as string;
  });

test('an admin sees a failed job with its error and a count on the Settings entry, and retries it once', async ({
  page,
  t,
}) => {
  const job = await plantFailure();
  await signIn(page, 'admin');

  await page.goto('/settings');
  await expect(page.getByRole('link', { name: /Background jobs/ })).toContainText(/\d+ failed/);

  await page.goto('/settings/jobs');
  await expect(page.getByRole('heading', { name: t('jobs.title'), exact: true })).toBeVisible();
  const row = page.getByRole('listitem').filter({ hasText: job.error });
  await expect(row).toBeVisible();
  await expect(row).toContainText(KIND);
  await expect(row).toContainText(t('jobs.tag.failed'));
  await expect(row).toContainText('2 attempts');

  const retry = row.getByRole('button', { name: t('jobs.retryJob', { kind: KIND }) });
  const box = await retry.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await retry.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('status').filter({ hasText: 'was run again' })).toBeVisible();
  await expect(row).toHaveCount(0);
  expect(await stateOf(job.id)).not.toBe('failed');
});

test('a new failure shows up on the open screen without a reload, and an empty list says so', async ({
  page,
  t,
}) => {
  await signIn(page, 'admin');
  await page.goto('/settings/jobs');
  await expect(page.getByRole('heading', { name: t('jobs.title'), exact: true })).toBeVisible();

  const job = await plantFailure();
  // The list is read every 30 s; the goal is 60.
  await expect(page.getByText(job.error)).toBeVisible({ timeout: 60_000 });

  await withPool((pool) =>
    pool.query("DELETE FROM pgboss.job WHERE name = $1 AND state = 'failed'", [QUEUE]),
  );
  await expect(page.getByText(t('jobs.empty'), { exact: true })).toBeVisible({ timeout: 60_000 });
});

test('the screen works at 360 px with nothing wider than the phone', async ({ page, t }) => {
  const job = await plantFailure();
  await page.setViewportSize({ width: 360, height: 740 });
  await signIn(page, 'admin');
  await page.goto('/settings/jobs');
  await expect(page.getByText(job.error)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const retry = page.getByRole('button', { name: t('jobs.retryJob', { kind: KIND }) }).first();
  expect((await retry.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
});

for (const username of ['op', 'asha']) {
  test(`${username} cannot open the background jobs screen`, async ({ page }) => {
    await plantFailure();
    await signIn(page, username);
    await page.goto('/settings/jobs');
    await expect(
      page.getByRole('heading', { name: 'No settings access', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('planted failure')).toHaveCount(0);
  });
}
