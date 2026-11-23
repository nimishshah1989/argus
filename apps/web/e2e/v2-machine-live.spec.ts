import { expect, test } from './test.js';
import { MACHINES, signIn } from './fixtures.js';

/**
 * The v2 Machine page is live at `/analytics/machines/:id` on the real server, with the engine's real figures and the
 * plant's own machine. A chip on the page opens a drawer in the URL; Back closes it. The machine's id and its code both
 * reach it (a drawer's "Open full page" link carries the code).
 */
const MACHINE = MACHINES[0]!;

test('the Machine page opens at its v1 address on the real server; a chip opens the drawer and Back closes it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'head');

  await page.goto(`/analytics/machines/${MACHINE.id}`);
  await expect(
    page.getByRole('heading', { level: 1, name: MACHINE.code, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Breakdowns', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Nameplate', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('[data-state="loading"]')).toHaveCount(0);

  // The same page by the machine's code.
  await page.goto(`/analytics/machines/${MACHINE.code}`);
  await expect(
    page.getByRole('heading', { level: 1, name: MACHINE.code, exact: true }),
  ).toBeVisible();

  // The page's own machine chip opens the drawer from the plant's list; Back closes it.
  await page.getByRole('button', { name: MACHINE.code, exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`[?&]drawer=machine:${MACHINE.code}`));
  const drawer = page.locator('aside.v2-drawer');
  await expect(drawer).not.toHaveAttribute('inert', '');
  await expect(drawer.getByText('We could not find this one', { exact: false })).toHaveCount(0);
  await page.goBack();
  await expect(drawer).toHaveAttribute('inert', '');
  await expect(page).not.toHaveURL(/drawer=/);
});

test('a machine the engine has no page for says so', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'head');
  await page.goto('/analytics/machines/ZZ-0');
  await expect(page.getByText('The engine has no page for this machine yet.')).toBeVisible();
});
