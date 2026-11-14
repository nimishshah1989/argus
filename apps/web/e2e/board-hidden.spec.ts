import { Pool } from 'pg';
import { commandViaApi, getJson } from './fixtures-actions.js';
import { expect, test } from './test.js';
import {
  MACHINES,
  SEGMENT,
  TENANT,
  apiFetch,
  apiLogin,
  raiseTicketViaApi,
  signIn,
} from './fixtures.js';

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

/** The board's counts match what it shows (orchestrator ruling): a breakdown on a hidden machine moves no count. */
test('a breakdown on a hidden machine changes no board count', async ({ page }) => {
  const token = await apiLogin('asha');
  const config = await apiFetch('/api/v1/config', {
    headers: { authorization: `Bearer ${token}` },
  });
  const { machines } = (await config.json()) as { machines: { id: string; code: string }[] };
  await signIn(page, 'asha');
  await page.goto('/desk/board');
  await expect(page.getByRole('heading', { name: 'Live board' })).toBeVisible();
  const read = async () =>
    Promise.all(
      ['total', 'stopped'].map(async (k) => page.getByTestId(`count-${k}`).textContent()),
    );
  const before = await read();
  const raised: string[] = [];
  for (const code of ['HID-1', 'OFF-1']) {
    const machine = machines.find((m) => m.code === code)!;
    // A retry finds the first try's ticket still open (409): that is the same state.
    const ticket = await raiseTicketViaApi(token, machine.id, `Hidden check ${code}`).catch(
      (error: Error) => {
        if (!/409/.test(error.message)) throw error;
        return null;
      },
    );
    if (ticket) raised.push(ticket.id);
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Live board' })).toBeVisible();
  expect(await read()).toEqual(before);

  const me = await getJson<{ user: { actingPersonId: string } }>(token, '/api/v1/auth/me');
  for (const id of raised)
    await commandViaApi(token, id, 'cancel', {
      personId: me.user.actingPersonId,
      reason: 'Check done',
    });
});
