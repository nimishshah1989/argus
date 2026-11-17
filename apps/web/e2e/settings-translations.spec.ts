import { expect, test } from './test.js';
import { apiFetch, apiLogin, signIn } from './fixtures.js';

const GUJARATI = 'મશીન';

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

test('admin types Gujarati for a missing key; it shows at once and after a reload', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'admin');
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
