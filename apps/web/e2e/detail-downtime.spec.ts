import { Pool } from 'pg';
import { expect, test } from './test.js';
import { commandViaApi, getJson } from './fixtures-actions.js';
import { apiLogin, machineFor, raiseTicketViaApi, signIn } from './fixtures.js';

/** An open stopped ticket's Downtime tile runs; it does not sit at 0 until the close. */
test('shows running downtime on an open stopped ticket', async ({ page }, testInfo) => {
  const machine = machineFor('desk', testInfo.project.name);
  const token = await apiLogin('asha');
  const ticket = await raiseTicketViaApi(token, machine.id, `Belt slipping on ${machine.code}`);
  const pool = new Pool({ connectionString: process.env.E2E_ADMIN_DATABASE_URL, max: 1 });
  try {
    await pool.query(
      "UPDATE ticket SET reported_at = now() - interval '90 minutes' WHERE id = $1",
      [ticket.id],
    );
  } finally {
    await pool.end();
  }
  try {
    await signIn(page, 'asha');
    await page.goto(`/desk/${ticket.id}`);
    const tile = page
      .locator('dt', { hasText: /^Downtime$/ })
      .locator('xpath=following-sibling::dd')
      .first();
    await expect(tile).toHaveText('1 h 30 min');
    // The facts card agrees, while the machine is still stopped.
    await expect(page.getByText('1 h 30 min so far')).toBeVisible();
  } finally {
    // the machine is shared with the desk journey: leave nothing open on it
    const me = await getJson<{ user: { actingPersonId: string } }>(token, '/api/v1/auth/me');
    await commandViaApi(token, ticket.id, 'cancel', {
      personId: me.user.actingPersonId,
      reason: 'Test cleanup',
    });
  }
});
