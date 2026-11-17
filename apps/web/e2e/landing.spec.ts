import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { E2E_PASSWORD } from './fixtures.js';

/** The account sheet's trigger and title say Account in either language (account.aria / account.title). */
const ACCOUNT = /^(Account|એકાઉન્ટ)$/;
const accountSheet = (page: Page) => page.getByRole('dialog', { name: ACCOUNT });

async function signIn(page: Page, username: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function openAccount(page: Page): Promise<void> {
  await page.getByRole('button', { name: ACCOUNT }).click();
  await expect(accountSheet(page)).toBeVisible();
}

/** Packet 1: an admin needs no URL to work; they land on the desk. */
test('an admin signs in and lands on the desk', async ({ page }) => {
  await signIn(page, 'admin');
  await expect(page).toHaveURL(/\/desk$/);
  await expect(page.getByRole('heading', { name: 'Open', exact: true })).toBeVisible();
});

/** Packet 1: the operator still lands on the floor, and is not offered the desk. */
test('an operator signs in, lands on the floor and has no Desk entry', async ({ page }) => {
  await signIn(page, 'op');
  await expect(page).toHaveURL(/\/floor$/);
  await expect(page.getByRole('heading', { name: 'Report a problem' })).toBeVisible();
  await openAccount(page);
  await expect(accountSheet(page).getByRole('link', { name: 'Desk', exact: true })).toHaveCount(0);
});

/** Packet 2: from the floor, an admin opens the account sheet and taps Desk; the desk offers Floor back. */
test('from the floor an admin opens the account sheet and taps Desk', async ({ page }) => {
  await signIn(page, 'admin');
  await expect(page).toHaveURL(/\/desk$/);
  await page.goto('/floor');
  await expect(page.getByRole('heading', { name: 'Report a problem' })).toBeVisible();
  await openAccount(page);
  await accountSheet(page).getByRole('link', { name: 'Desk', exact: true }).click();
  await expect(page).toHaveURL(/\/desk$/);
  await expect(page.getByRole('heading', { name: 'Open', exact: true })).toBeVisible();

  await openAccount(page);
  await accountSheet(page).getByRole('link', { name: 'Floor', exact: true }).click();
  await expect(page).toHaveURL(/\/floor$/);
});
