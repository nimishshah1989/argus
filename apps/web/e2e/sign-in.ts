import { expect, type Page } from '@playwright/test';

const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'correct-horse-battery';

/**
 * Signs in through the real login screen and waits until the app has rendered. A login now lands where its
 * role belongs — the desk for technician and above, the floor for operators — so the wait must not assume
 * one of them; callers that need a particular screen navigate to it themselves.
 */
export async function signIn(page: Page, username = 'asha'): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/(floor|desk)(\/|$|\?)/, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: /^(Account|એકાઉન્ટ)$/ })).toBeVisible();
}
