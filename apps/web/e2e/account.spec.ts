import { expect, test } from './test.js';
import { signIn } from './fixtures.js';

/** Slice 5 (tickets 21 and 25): the account sheet and the Alerts control, on the floor and on the desk. */
const account = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog', { name: 'Account' });
const openAccount = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(account(page)).toBeVisible();
};

test('the account sheet opens from the floor and says who is signed in', async ({ page }) => {
  await signIn(page, 'asha');
  await openAccount(page);
  await expect(account(page).getByText('Signed in as asha')).toBeVisible();
  await expect(account(page).getByText('Technician', { exact: true })).toBeVisible();
  await expect(account(page).getByRole('button', { name: 'Change person' })).toHaveCount(0);
  await expect(account(page).getByText('Support access')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(account(page)).toHaveCount(0);
});

test('Sign out asks first; Go back keeps the person signed in', async ({ page }) => {
  await signIn(page, 'asha');
  await openAccount(page);
  await account(page).getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('Sign out of this phone?')).toBeVisible();
  await expect(page.getByText('Alerts stop on this phone.')).toBeVisible();
  await page.getByRole('button', { name: 'Go back' }).click();
  await expect(page).toHaveURL(/\/floor/);
  await expect(account(page).getByText('Signed in as asha')).toBeVisible();
  await account(page).getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('language is a choice kept for this phone', async ({ page }) => {
  await signIn(page, 'asha');
  await openAccount(page);
  const english = account(page).getByRole('button', { name: 'English' });
  const gujarati = account(page).getByRole('button', { name: 'ગુજરાતી' });
  await expect(english).toHaveAttribute('aria-pressed', 'true');
  await gujarati.click();
  await expect(gujarati).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await openAccount(page);
  await expect(account(page).getByRole('button', { name: 'ગુજરાતી' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('a shared phone shows who is acting and Change person opens the picker', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('cell-phone');
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/who/);
  await page.getByLabel('Your name').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/floor/);
  await openAccount(page);
  await expect(account(page).getByText('Shared phone')).toBeVisible();
  await expect(account(page).getByText('Acting now')).toBeVisible();
  await account(page).getByRole('button', { name: 'Change person' }).click();
  await expect(page).toHaveURL(/\/who/);
});

test('the support-access note shows only when the session carries a grant', async ({ page }) => {
  await page.route('**/api/v1/auth/me', async (route) => {
    const reply = await route.fetch();
    const body = (await reply.json()) as { user: Record<string, unknown> };
    await route.fulfill({
      response: reply,
      json: { user: { ...body.user, supportGrantId: 'grant-1' } },
    });
  });
  await signIn(page, 'asha');
  await openAccount(page);
  await expect(account(page).getByText('Support access', { exact: true })).toBeVisible();
  await expect(
    account(page).getByText('Every action you take is in the audit trail.'),
  ).toBeVisible();
  await expect(account(page).getByRole('link', { name: 'Change password' })).toHaveCount(0);
});

test.describe('Alerts', () => {
  test('where the browser cannot show alerts, it says so and offers no switch', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      delete (window as unknown as Record<string, unknown>).PushManager;
    });
    await signIn(page, 'asha');
    await openAccount(page);
    const alerts = account(page).getByRole('region', { name: 'Alerts' });
    await expect(alerts.getByText('Not available', { exact: true })).toBeVisible();
    await expect(alerts.getByText('This browser cannot show alerts')).toBeVisible();
    await expect(alerts.getByRole('button')).toHaveCount(0);
  });

  test('blocked alerts say where to allow them, and Check again notices the change', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __permission: string };
      w.__permission = 'denied';
      Object.defineProperty(Notification, 'permission', { get: () => w.__permission });
    });
    await signIn(page, 'asha');
    await openAccount(page);
    const alerts = account(page).getByRole('region', { name: 'Alerts' });
    await expect(alerts.getByText('Blocked by the browser', { exact: true })).toBeVisible();
    await expect(
      alerts.getByText('Allow notifications in the phone settings to turn them on.'),
    ).toBeVisible();
    await alerts.getByRole('button', { name: 'Check again' }).click();
    await expect(alerts.getByText('Blocked by the browser', { exact: true })).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { __permission: string }).__permission = 'default';
    });
    await alerts.getByRole('button', { name: 'Check again' }).click();
    await expect(alerts.getByText('Off', { exact: true })).toBeVisible();
    await expect(alerts.getByRole('button', { name: 'Turn on alerts' })).toBeVisible();
  });
});

test('on a wide screen the name at the foot of the left menu opens a side panel', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'asha');
  await page.goto('/desk');
  const menu = page.getByRole('navigation', { name: 'Desk' });
  await menu.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(account(page)).toBeVisible();
  const box = await account(page).boundingBox();
  expect(box && box.x + box.width).toBeGreaterThan(1400);
  expect(box && box.width).toBeLessThan(430);
});
