import { expect, test } from './test.js';
import { signIn } from './fixtures.js';

/**
 * Ticket 37b: the analytics face, its Guide entry and the profile screen. No engine is registered yet
 * (COMPUTERS is empty), so every figure is honestly "Not computed yet"; the journey never waits for a
 * drill reply (sibling packet 37a adds that route).
 */
test('a head opens the analytics face, its Guide, and edits the plant profile', async ({
  page,
}, testInfo) => {
  const wide = testInfo.project.name === 'chromium';
  if (wide) await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'head');

  // The desk offers the face to a head: the desktop left menu, where the desk's own destinations live.
  if (wide) await expect(page.getByRole('link', { name: 'Analytics', exact: true })).toBeVisible();

  await page.goto('/analytics');
  await expect(page).toHaveURL(/\/analytics\/today$/);
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();

  const menu = page.getByRole('navigation', { name: 'Analytics', exact: true });
  for (const name of [
    'Today',
    'Machines',
    'Breakdowns',
    'Forecast & scorecard',
    'PM',
    'Cost',
    'Reports',
    'Guide',
  ])
    await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();

  // The honest state: the registry's figures are listed, and none claims a value it does not have.
  await expect(page.getByText('Not computed yet').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();

  // The Guide lists the screens and figures with their labels.
  await menu.getByRole('link', { name: 'Guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Guide', exact: true })).toBeVisible();
  await expect(page.getByText('Total machines', { exact: true }).first()).toBeVisible();

  // Settings → the analytics profile: one number saves on the real route and survives a reload.
  await page.goto('/settings/analytics-profile');
  await expect(page.getByRole('heading', { name: 'Analytics profile', exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: /^Edit / })
    .first()
    .click();
  const form = page.getByRole('form', { name: /^Edit / });
  await form.getByLabel('Production hours per day', { exact: true }).fill('21');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form).toBeHidden();

  await page.reload();
  await page
    .getByRole('button', { name: /^Edit / })
    .first()
    .click();
  await expect(
    page
      .getByRole('form', { name: /^Edit / })
      .getByLabel('Production hours per day', { exact: true }),
  ).toHaveValue('21');
});

test('an operator gets no analytics entry and no analytics profile', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'op');
  await expect(page.getByRole('link', { name: 'Analytics', exact: true })).toHaveCount(0);

  await page.goto('/settings/analytics-profile');
  await expect(
    page.getByRole('heading', { name: 'No settings access', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0);
});
