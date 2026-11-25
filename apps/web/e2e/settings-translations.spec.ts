import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { E2E_PASSWORD, apiFetch, apiLogin } from './fixtures.js';

const GUJARATI = 'મશીન';

/** Sign in without assuming where an admin lands (the floor today, the desk for the sign-in ticket's change). */
async function signInAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/desk|\/floor/);
}

/** Put the plant's overrides back: the rest of the run, and any later spec on this worker, sees none. */
async function clearOverrides(): Promise<void> {
  const token = await apiLogin('admin');
  const res = await apiFetch('/api/v1/settings/i18n.overrides', {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ value: {} }),
  });
  expect(res.status).toBe(200);
}

// Gujarati is hidden by default (ADR 0036 R25); this check proves the overrides still work with it switched on.
test.use({ gujaratiOn: true });

test('admin types Gujarati for a missing key; it shows at once and after a reload', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  await signInAdmin(page);
  // Read the app in Gujarati: this project seeds English, so the phone's own choice is Gujarati.
  await page.evaluate(() => localStorage.setItem('uptimo.language', 'gu'));
  await page.reload();
  await page.goto('/settings/translations');
  await expect(page.getByRole('heading', { name: 'Translations', exact: true })).toBeVisible();
  if (testInfo.project.name === 'chromium')
    await expect(page.getByRole('link', { name: 'Machines', exact: true })).toBeVisible();

  // The key has no bundled Gujarati, so it is on the list with its English. `#translation-search` because the
  // screen's own search label is itself an untranslated key, so `getByLabel` would also match that row.
  await page.locator('#translation-search').fill('plant.menu.machines');
  const field = page.getByLabel('Machines', { exact: true });
  await expect(field).toBeVisible();
  await field.fill(GUJARATI);
  await page.getByRole('button', { name: 'Save translations', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();

  // Off the missing list, and the menu entry it belongs to now reads Gujarati — no reload.
  await expect(page.getByLabel('Machines', { exact: true })).toHaveCount(0);
  if (testInfo.project.name === 'phone') await page.goto('/settings');
  // The phone's settings list also carries the entry's sub-line, so the name is not exact.
  await expect(page.getByRole('link', { name: new RegExp(GUJARATI) })).toBeVisible();

  // The override is read from /config at load, so it survives a reload.
  await page.reload();
  await expect(page.getByRole('link', { name: new RegExp(GUJARATI) })).toBeVisible();

  await clearOverrides();
});
