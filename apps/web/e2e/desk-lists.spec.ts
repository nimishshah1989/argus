import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { apiLogin, machineFor, raiseTicketViaApi, signIn } from './fixtures.js';

/** Ticket 16 goal 1: Open, Mine, Team and needs-report from the bottom tab bar, by role (v3.views.01–05). */
test.describe.configure({ mode: 'serial' });

const tabs = (page: Page) => page.getByRole('navigation', { name: 'Desk' });

test('Open: counts strip, Team now, Breakdowns / Tasks / Work, and a tap on a count filters', async ({
  page,
}, testInfo) => {
  const machine = machineFor('desk', testInfo.project.name);
  const token = await apiLogin('asha');
  const stopped = await raiseTicketViaApi(token, machine.id, `List check on ${machine.code}`);
  const work = await raiseTicketViaApi(token, null, 'List check: fix the store door');

  await signIn(page, 'asha');
  await page.goto('/desk');
  await expect(tabs(page).getByRole('link')).toHaveText([/Open/, 'Mine', 'Team', 'Report', 'Live']);
  await expect(tabs(page).getByRole('link', { name: /Open/ })).toHaveAttribute(
    'aria-current',
    'page',
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
});

test('Mine and Team open from the tab bar, and the card opens the ticket', async ({ page }) => {
  await signIn(page, 'asha');
  await page.goto('/desk');
  await tabs(page).getByRole('link', { name: 'Mine' }).click();
  await expect(page).toHaveURL(/\/desk\/mine$/);
  await expect(page.getByRole('heading', { name: 'My tickets', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Day report' })).toBeVisible();
  await tabs(page).getByRole('link', { name: 'Team' }).click();
  await expect(page).toHaveURL(/\/desk\/team$/);
  await expect(page.getByRole('heading', { name: 'Team now', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Closed, last 30 days' })).toBeVisible();
  await expect(tabs(page).getByRole('link', { name: 'Report' })).toHaveAttribute('href', '/floor');
  await expect(tabs(page).getByRole('link', { name: 'Live' })).toHaveAttribute(
    'href',
    '/desk/board',
  );
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
  });
}

test('an operator is offered Report a problem instead', async ({ page }) => {
  await signIn(page, 'op');
  await page.goto('/desk');
  await page.getByRole('link', { name: 'Report a problem' }).click();
  await expect(page).toHaveURL(/\/floor$/);
});
