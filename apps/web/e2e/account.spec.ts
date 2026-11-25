import { expect, test } from './test.js';
import { signIn } from './fixtures.js';

/** Slice 5 (tickets 21 and 25): the account sheet and the Alerts control, on the floor and on the desk. */
// The sheet's title and trigger are translated, so the locators must not depend on the language: after a
// language switch (and after a reload that keeps it) the same control reads "એકાઉન્ટ".
const ACCOUNT_NAME = /^(Account|એકાઉન્ટ)$/;
const account = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog', { name: ACCOUNT_NAME });
const openAccount = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: ACCOUNT_NAME }).click();
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
  await expect(page).toHaveURL(/\/(floor|desk)/);
  await expect(account(page).getByText('Signed in as asha')).toBeVisible();
  await account(page).getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('Gujarati is hidden by default: no language choice, and a saved gu still shows English', async ({
  page,
}) => {
  await signIn(page, 'asha');
  await page.evaluate(() => localStorage.setItem('uptimo.language', 'gu'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await openAccount(page);
  await expect(account(page).getByRole('button', { name: 'ગુજરાતી' })).toHaveCount(0);
  await expect(account(page).getByRole('button', { name: 'English' })).toHaveCount(0);
});

test.describe('Gujarati switched on', () => {
  test.use({ gujaratiOn: true });
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

/** A phone whose alerts are already on: a stubbed registration and a granted permission. */
async function withAlertsOn(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __push: string[] };
    w.__push = [];
    Object.defineProperty(window, 'PushManager', { value: function PushManager() {} });
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-account',
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-account',
        keys: { p256dh: 'e2e-key', auth: 'e2e-auth' },
      }),
      unsubscribe: async () => {
        w.__push.push('unsubscribe');
        return true;
      },
    };
    const registration = { pushManager: { getSubscription: async () => subscription } };
    Object.defineProperty(navigator.serviceWorker, 'getRegistration', {
      value: async () => registration,
    });
  });
}

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

test.describe('Alerts already on', () => {
  test('alerts already on for this phone say so and send the test through the server', async ({
    page,
  }) => {
    const tests: string[] = [];
    await page.route('**/api/v1/push/test', async (route) => {
      tests.push(route.request().method());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"sent":1}' });
    });
    await withAlertsOn(page);
    await signIn(page, 'asha');
    await openAccount(page);
    const alerts = account(page).getByRole('region', { name: 'Alerts' });
    await expect(alerts.getByText('On', { exact: true })).toBeVisible();
    await expect(alerts.getByText('Alerts are on for this phone')).toBeVisible();
    await alerts.getByRole('button', { name: 'Send a test' }).click();
    await expect(alerts.getByText('Test sent. It should arrive in a moment.')).toBeVisible();
    expect(tests).toEqual(['POST']);
  });

  test('signing out stops alerts on the server before the session ends', async ({ page }) => {
    const order: string[] = [];
    await page.route('**/api/v1/push/unsubscribe', async (route) => {
      order.push('unsubscribe');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.route('**/api/v1/auth/logout', async (route) => {
      order.push('logout');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await withAlertsOn(page);
    await signIn(page, 'asha');
    await openAccount(page);
    await account(page).getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(order).toEqual(['unsubscribe', 'logout']);
    expect(
      await page.evaluate(() =>
        (window as unknown as { __push: string[] }).__push.includes('unsubscribe'),
      ),
    ).toBe(true);
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
