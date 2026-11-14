import { Pool } from 'pg';
import { expect, test } from './test.js';
import { MACHINES, SEGMENT, TENANT, signIn } from './fixtures.js';

/** A hidden machine group and a segment kept off the board (Settings, #195) take their machines off the board. */
test.beforeAll(async () => {
  const pool = new Pool({ connectionString: process.env.E2E_ADMIN_DATABASE_URL, max: 1 });
  try {
    await pool.query(
      `WITH g AS (
         INSERT INTO machine_group (tenant_id, segment_id, code, name, hidden)
         VALUES ($1, $2, 'HID', 'Hidden group', true)
         ON CONFLICT (tenant_id, segment_id, code) DO UPDATE SET hidden = true
         RETURNING id)
       INSERT INTO machine (tenant_id, code, segment_id, group_id)
       SELECT $1, 'HID-1', $2, g.id FROM g
       WHERE NOT EXISTS (SELECT 1 FROM machine WHERE tenant_id = $1 AND code = 'HID-1')`,
      [TENANT.id, SEGMENT.id],
    );
    await pool.query(
      `WITH s AS (
         INSERT INTO segment (tenant_id, code, name, show_on_board)
         VALUES ($1, 'OFFB', 'Off the board', false)
         ON CONFLICT (tenant_id, code) DO UPDATE SET show_on_board = false
         RETURNING id)
       INSERT INTO machine (tenant_id, code, segment_id)
       SELECT $1, 'OFF-1', s.id FROM s
       WHERE NOT EXISTS (SELECT 1 FROM machine WHERE tenant_id = $1 AND code = 'OFF-1')`,
      [TENANT.id],
    );
  } finally {
    await pool.end();
  }
});

test('the board leaves out a hidden group and a segment kept off the board', async ({ page }) => {
  await signIn(page, 'asha');
  await page.goto('/desk/board');
  await expect(page.getByRole('heading', { name: 'Live board' })).toBeVisible();
  const tiles = page.getByTestId('tile');
  await expect(tiles.filter({ hasText: MACHINES[0]!.code }).first()).toBeVisible();
  await expect(tiles.filter({ hasText: 'HID-1' })).toHaveCount(0);
  await expect(tiles.filter({ hasText: 'OFF-1' })).toHaveCount(0);
  await expect(page.getByText('Off the board')).toHaveCount(0);
});
