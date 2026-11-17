import { expect, type Page } from '@playwright/test';

const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'correct-horse-battery';

/**
 * Signs in through the real login screen and waits until the app has rendered. A login lands where its role
 * belongs — the head's Today face, the operator's My complaints, the desk's own view, or the floor — so the
 * wait must not assume one of them; callers that need a particular screen navigate to it themselves.
 */
export async function signIn(page: Page, username = 'asha'): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/(floor|desk|analytics\/today)(\/|$|\?)/, { timeout: 15_000 });
  await expect(page.locator('main')).toBeVisible();
}
