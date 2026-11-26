import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { apiLogin, machineFor, raiseTicketViaApi, signIn } from './fixtures.js';
import { commandViaApi, getJson } from './fixtures-actions.js';

/** Ticket 16 goal 1: Open, Mine, Team and needs-report from the desk's section tabs (S28), by role (v3.views.01–05). */
test.describe.configure({ mode: 'serial' });

const tabs = (page: Page) => page.getByRole('group', { name: 'Desk' });

/** Mine and Team from the section tabs, then the way to the floor and the Live board. */
async function mineAndTeam(page: Page): Promise<void> {
  // Mine and Team from the section tabs (same sign-in: the server caps sign-ins per address).
  await tabs(page).getByRole('button', { name: 'Mine' }).click();
  await expect(page).toHaveURL(/\/desk\/mine$/);
  await expect(page.getByRole('heading', { name: 'My tickets', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Day report' })).toBeVisible();
  await tabs(page).getByRole('button', { name: 'Team' }).click();
  await expect(page).toHaveURL(/\/desk\/team$/);
  await expect(page.getByRole('heading', { name: 'Team now', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Closed, last 30 days' })).toBeVisible();
  await expect(tabs(page).getByRole('button', { name: 'Team' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('link', { name: 'Report a problem' })).toHaveAttribute(
    'href',
    '/floor',
  );
  await tabs(page).getByRole('button', { name: 'Live' }).click();
  await expect(page).toHaveURL(/\/desk\/board$/);
}

test('Open: counts strip, Team now, Breakdowns / Tasks / Work, a tap on a count filters; Mine and Team', async ({
  page,
}, testInfo) => {
  const machine = machineFor('desk', testInfo.project.name);
  const token = await apiLogin('asha');
  const stopped = await raiseTicketViaApi(token, machine.id, `List check on ${machine.code}`);
  const work = await raiseTicketViaApi(token, null, 'List check: fix the store door');

  await signIn(page, 'asha');
  await page.goto('/desk');
  await expect(tabs(page).getByRole('button')).toHaveText([
    /^Open \(\d+\)$/,
    'Mine',
    'Team',
    'Live',
  ]);
  await expect(tabs(page).getByRole('button', { name: /Open/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('link', { name: 'Report a problem' })).toHaveAttribute(
    'href',
    '/floor',
  );
  await expect(page.getByRole('heading', { name: 'Open', level: 1 })).toBeVisible();
  await expect(page.getByTestId('sync-status')).toHaveText(/Online/);

  const counts = page.getByRole('group', { name: 'Machine status' });
  for (const word of ['Down', 'Waiting', 'Support', 'Running OK'])
    await expect(counts.getByRole('button', { name: new RegExp(word) })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Team now/ })).toBeVisible();

  const lists = page.getByRole('group', { name: 'Open lists' });
  await expect(lists.getByRole('button', { name: /^Breakdowns \(\d+\)$/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('link', { name: new RegExp(stopped.ref) })).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(work.ref) })).toHaveCount(0);

  await lists.getByRole('button', { name: /^Work \(\d+\)$/ }).click();
  await expect(page.getByRole('link', { name: new RegExp(work.ref) })).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(stopped.ref) })).toHaveCount(0);

  await lists.getByRole('button', { name: /^Breakdowns/ }).click();
  await counts.getByRole('button', { name: /Support/ }).click();
  await expect(counts.getByRole('button', { name: /Support/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('Showing support requests. Tap to show all.')).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(stopped.ref) })).toHaveCount(0);
  await counts.getByRole('button', { name: /Down/ }).click();
  await expect(page.getByRole('link', { name: new RegExp(stopped.ref) })).toBeVisible();

  // Free the desk machine for the lifecycle spec.
  const me = await getJson<{ user: { actingPersonId: string } }>(token, '/api/v1/auth/me');
  const personId = me.user.actingPersonId;
  for (const id of [stopped.id, work.id])
    await commandViaApi(token, id, 'cancel', { personId, reason: 'List check done' });

  await mineAndTeam(page);
});

for (const [login, path] of [
  ['op', '/desk'],
  ['brd', '/desk'],
  ['ph', '/desk/mine'],
] as const) {
  test(`${login} on ${path} sees "Not available to you"`, async ({ page }) => {
    await signIn(page, login);
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Not available to you' })).toBeVisible();
    await expect(
      page.getByText('Your login does not include this screen. If you need it, ask your admin.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Breakdowns/ })).toHaveCount(0);
    if (login !== 'op') return;
    // An operator is offered Report a problem instead.
    await page.getByRole('link', { name: 'Report a problem' }).click();
    await expect(page).toHaveURL(/\/floor$/);
  });
}
