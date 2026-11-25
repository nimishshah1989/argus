import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { MACHINES, apiFetch, apiLogin, signIn } from './fixtures.js';

/**
 * The v2 Dashboard is live at `/analytics/today` on the real server, with the engine's real figures. The one stub is
 * the desk's `/state`: the seed has no breached clock, so one ticket on a real machine is added to its reply to give the
 * strip, and the machine chip, something to open.
 */
const MACHINE = MACHINES[0]!;

async function stubStrip(page: Page): Promise<void> {
  const token = await apiLogin('head');
  await page.route('**/api/v1/state', async (route) => {
    const reply = await apiFetch('/api/v1/state', {
      headers: { authorization: `Bearer ${token}` },
    });
    const state = (await reply.json()) as { open: unknown[] };
    state.open.push({
      id: '10000000-0000-4000-8000-0000000000d1',
      ref: 'BD-2611-11-1',
      kind: 'stopped',
      status: 'open',
      machineId: MACHINE.id,
      problem: 'Spindle alarm',
      reportedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      machineRunningAt: null,
      machineStoppedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      waitSince: null,
      handedOver: false,
      parentId: null,
      taskExpectedOn: null,
      location: null,
      sla: { ack: { breached: true }, restore: { breached: false } },
    });
    await route.fulfill({ json: state });
  });
}

test('the Dashboard opens at its v1 address with the engine’s figures; a machine opens in the drawer and Back closes it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubStrip(page);
  const response = page.waitForResponse(
    (reply) => reply.url().includes('/api/v1/analytics/figures') && reply.status() === 200,
  );
  await signIn(page, 'head');
  await expect(page).toHaveURL(/\/analytics\/today$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  const reply = (await (await response).json()) as FiguresReply;

  // Every number figure the engine sent is a card; the strip is built from the desk's own state.
  const numbers = reply.figures.filter(
    (figure) => figure.screen === 'dashboard' && typeof figure.value === 'number',
  );
  expect(numbers.length).toBeGreaterThan(5);
  // Figures past the fourth fold under "Show detail" (sweep 706); a no-op before the fold lands.
  for (const s of await page.locator('details.v2-show-detail:not([open]) > summary').all())
    await s.click();
  await expect(page.getByRole('region', { name: 'Total machines', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'What needs you now' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  // A machine chip opens the plant's own machine; Back closes it.
  const strip = page.getByRole('region', { name: 'What needs you now' });
  await strip.getByRole('button', { name: MACHINE.code, exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`[?&]drawer=machine:${MACHINE.code}`));
  const drawer = page.locator('aside.v2-drawer');
  await expect(drawer).not.toHaveAttribute('inert', '');
  await expect(drawer.getByText('We could not find this one', { exact: false })).toHaveCount(0);
  await page.goBack();
  await expect(drawer).toHaveAttribute('inert', '');
  await expect(page).not.toHaveURL(/drawer=/);
});
