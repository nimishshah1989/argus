import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { signIn } from './fixtures.js';

/**
 * Ticket 21 goal 2 (v3.signin.03, slice 3 T2; Nimish 14 Nov: the floor and the desk pick from the people
 * list). A shared phone asks who is using it once, after sign-in; the server's "choose who is acting" and
 * "must change password" answers reopen their step from anywhere.
 */
async function signInShared(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('cell-phone');
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('a shared phone asks who is using it once, then the floor works as that person', async ({
  page,
}) => {
  await signInShared(page);
  await expect(page.getByRole('heading', { name: 'Who is using this phone?' })).toBeVisible();
  await expect(page.getByText('Shared phone', { exact: false })).toBeVisible();
  const cont = page.getByRole('button', { name: 'Continue', exact: true });
  await expect(cont).toBeDisabled();
  await page.getByLabel('Your name').selectOption({ label: 'Omi' });
  await cont.click();
  await expect(page.getByRole('heading', { name: 'Report a problem' })).toBeVisible();

  await page.getByRole('button', { name: /^Other work \(not a machine\)/ }).click();
  await expect(page.getByText('Reporting as Omi')).toBeVisible();
});

test('the server asking again who is acting reopens the step', async ({ page }) => {
  await signIn(page, 'op');
  await page.route(/\/api\/v1\/state(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'choose_acting_person',
          message: 'Choose who is using this phone to continue',
        },
      }),
    }),
  );
  await page.goto('/floor');
  await expect(page.getByRole('heading', { name: 'Who is using this phone?' })).toBeVisible();
});

test('a login that must change its password goes to that step and checks the two new ones match', async ({
  page,
}) => {
  await signIn(page, 'op');
  await page.route(/\/api\/v1\/state(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'must_change_password', message: 'Change your password to continue' },
      }),
    }),
  );
  await page.goto('/floor');
  await expect(page.getByRole('heading', { name: 'Change your password' })).toBeVisible();
  await page.getByLabel('Current password').fill('correct-horse-battery');
  await page.getByLabel('New password (at least 8 characters)').fill('a-new-long-phrase');
  await page.getByLabel('New password again').fill('a-new-long-phrasf');
  await expect(page.getByText('The two new passwords are not the same')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save password', exact: true })).toBeDisabled();
});
