import { expect, test } from './test.js';
import { apiFetch, apiLogin, signIn } from './fixtures.js';

/** A 1×1 PNG: real image bytes, which is what the logo route reads them as. */
const LOGO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('admin edits the company name, language, time zone and features, and uploads a logo', async ({
  page,
  uiLanguage,
}, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'admin');
  await page.goto('/settings/company');
  await expect(page.getByRole('heading', { name: 'Company', exact: true })).toBeVisible();

  await expect(page.getByLabel('Company name', { exact: true })).toHaveValue('Cosmos');
  await expect(page.getByLabel('Time zone', { exact: true })).toHaveValue('Asia/Kolkata');
  await expect(page.getByLabel('Language', { exact: true })).toHaveValue(uiLanguage);
  for (const name of ['Work requests', 'Pause: waiting', 'Live board for operators']) {
    await expect(page.getByRole('checkbox', { name, exact: true })).toBeVisible();
  }

  // The logo goes up as raw bytes to its own route and the sign-in brand serves it back.
  await page.getByLabel('Choose a file', { exact: true }).setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: LOGO,
  });
  await page.getByRole('button', { name: 'Upload logo', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Logo updated.' })).toBeVisible();
  await expect(page.getByAltText('Current logo', { exact: true })).toHaveAttribute(
    'src',
    /\/api\/v1\/brand\/logo\?v=/,
  );
  await page.reload();
  await expect(page.getByAltText('Current logo', { exact: true })).toBeVisible();
});

test('saving sends one request per changed key, the feature record once', async ({ page }) => {
  const token = await apiLogin('admin');
  const reply = await apiFetch('/api/v1/settings', {
    headers: { authorization: `Bearer ${token}` },
  });
  const rows = (await reply.json()) as { key: string; value: unknown }[];
  const name = String(rows.find((row) => row.key === 'company.name')?.value ?? '');
  const features = (rows.find((row) => row.key === 'features')?.value ?? {}) as Record<
    string,
    boolean
  >;
  const puts: { url: string; body: { value: unknown } }[] = [];
  await page.route('**/api/v1/settings/**', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    puts.push({
      url: route.request().url(),
      body: JSON.parse(route.request().postData() ?? '{}') as { value: unknown },
    });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  await signIn(page, 'admin');
  await page.goto('/settings/company');
  await page.getByLabel('Company name', { exact: true }).fill(`${name} Works`);
  await page.getByRole('checkbox', { name: 'Live board for operators', exact: true }).check();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();

  expect(puts).toHaveLength(2);
  expect(puts.find((put) => put.url.endsWith('/company.name'))?.body).toEqual({
    value: `${name} Works`,
  });
  expect(puts.find((put) => put.url.endsWith('/features'))?.body).toEqual({
    value: {
      general: features.general ?? false,
      pause: features.pause ?? false,
      floorLive: true,
    },
  });
});

test('a feature switch saves on the real route and survives a reload', async ({ page }) => {
  await signIn(page, 'admin');
  await page.goto('/settings/company');
  const live = page.getByRole('checkbox', { name: 'Live board for operators', exact: true });
  await expect(live).not.toBeChecked();
  await live.check();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('checkbox', { name: 'Live board for operators', exact: true }),
  ).toBeChecked();

  // Put it back: the rest of the run sees the plant's own setting.
  await page.getByRole('checkbox', { name: 'Live board for operators', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
});

test('a technician who opens the company or the lists settings is told they have no access', async ({
  page,
}) => {
  await signIn(page, 'asha');
  for (const path of ['/settings/company', '/settings/lists?list=wait_reason']) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: 'No settings access', exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add wait reason', exact: true })).toHaveCount(0);
});
