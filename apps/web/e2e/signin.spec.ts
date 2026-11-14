import { expect, test } from './test.js';
import { E2E_PASSWORD } from './fixtures.js';

/** Ticket 21 goal 2 (v3.signin.01, .05): the sign-in screen of slice 3 board T1. */
const username = (page: import('@playwright/test').Page) =>
  page.getByLabel('Username', { exact: true });
const password = (page: import('@playwright/test').Page) =>
  page.getByLabel('Password', { exact: true });

test('a wrong password says so and keeps the person on sign-in', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('Cosmos')).toBeVisible();
  await username(page).fill('op');
  await password(page).fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Sign-in failed');
  await expect(page).toHaveURL(/\/login/);
});

test('show password reveals it, and the last username is remembered', async ({ page }) => {
  await page.goto('/login');
  await username(page).fill('op');
  await password(page).fill(E2E_PASSWORD);
  await expect(password(page)).toHaveAttribute('type', 'password');
  await page.getByRole('checkbox', { name: 'Show password' }).check();
  await expect(password(page)).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Report a problem' })).toBeVisible();

  await page.goto('/login');
  await expect(username(page)).toHaveValue('op');
  await expect(password(page)).toBeFocused();
});

test('a session the server no longer accepts signs the phone out with a message', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('uptimo_token', 'no-longer-valid'));
  await page.goto('/floor');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('status').filter({ hasText: 'You were signed out' })).toContainText(
    'Your session has ended. Sign in again.',
  );
});
