import type { Page } from '@playwright/test';
import { expect, test } from './test.js';

/**
 * Bug: ticket 832 (S19, after ticket 816 / PR 830): /who must say when choosing fails or cannot be sent, as v1's WizardPage did.
 * A failure that is not "choose a name" shows kit.wizard.error as an alert; offline shows kit.form.needsConnection.
 */
async function openWho(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('cell-phone');
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Who is using this phone?' })).toBeVisible();
}

test('a server failure while choosing says "Could not send" and keeps the step open', async ({
  page,
}) => {
  await openWho(page);
  await page.route(/\/api\/v1\/auth\/acting$/, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'internal', message: 'boom' } }),
        })
      : route.fallback(),
  );
  await page.getByLabel('Your name').selectOption({ label: 'Omi' });
  const cont = page.getByRole('button', { name: 'Continue', exact: true });
  await cont.click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not send. Try again.' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/who$/);
  // The person can try again: Continue is live once the failed send has settled.
  await expect(cont).toBeEnabled();
});

test('a dropped connection while choosing says "Could not send" too', async ({ page }) => {
  await openWho(page);
  await page.route(/\/api\/v1\/auth\/acting$/, (route) =>
    route.request().method() === 'POST' ? route.abort('internetdisconnected') : route.fallback(),
  );
  await page.getByLabel('Your name').selectOption({ label: 'Omi' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not send. Try again.' }),
  ).toBeVisible();
});

test('offline, the step says it needs a connection and Continue stays off', async ({ page }) => {
  await openWho(page);
  await page.getByLabel('Your name').selectOption({ label: 'Omi' });
  await page.context().setOffline(true);
  try {
    await expect(page.getByText('You are offline. Connect to send this.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  } finally {
    await page.context().setOffline(false);
  }
  await expect(page.getByText('You are offline. Connect to send this.')).toHaveCount(0);
});
