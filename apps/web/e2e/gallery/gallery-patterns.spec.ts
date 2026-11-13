import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`/gallery?${query}`);
  await page.getByTestId('gallery-root').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

async function crudRequests(
  page: Page,
): Promise<{ method: string; path: string; body: unknown }[]> {
  return page.evaluate(
    (u) => import(/* @vite-ignore */ u).then((m) => m.requests),
    '/src/gallery/crud-data.ts',
  );
}

const crudRow = (page: Page, code: string) =>
  page.getByTestId('gallery-crud').locator('tbody tr', { hasText: code });

const writes = async (page: Page) => (await crudRequests(page)).filter((r) => r.method !== 'GET');
const SAVE_ERROR = 'Could not save. Check the details and try again.';

test('crud: one short spec lists the machines and adds one through the API', async ({ page }) => {
  expect(
    readFileSync('apps/web/src/gallery/crud-spec.ts', 'utf8').split('\n').length,
  ).toBeLessThanOrEqual(60);
  await open(page, 'lang=en');
  const crud = page.getByTestId('gallery-crud');
  await expect(crud.locator('tbody tr')).toHaveCount(3);
  await expect(crudRow(page, 'CNC-07')).toContainText('VMC 850');
  await expect(crudRow(page, 'CNC-07')).toContainText('On');
  await expect(crudRow(page, 'DRILL-01')).toContainText('Off');
  await crud.getByRole('button', { name: 'Add', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Code').fill('MILL-03');
  await dialog.getByLabel('Name').fill('Milling machine');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(crud.locator('tbody tr')).toHaveCount(4);
  await expect(crudRow(page, 'MILL-03')).toContainText('Milling machine');
  await expect(crudRow(page, 'MILL-03')).toContainText('On');
  expect(await writes(page)).toEqual([
    {
      method: 'POST',
      path: '/gallery/machines',
      body: { code: 'MILL-03', name: 'Milling machine' },
    },
  ]);
  expect((await crudRequests(page))[0]).toMatchObject({ method: 'GET', path: '/gallery/machines' });
});

test('crud: edits a machine through the API', async ({ page }) => {
  await open(page, 'lang=en');
  await crudRow(page, 'LATHE-02').getByRole('button', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit LATHE-02' });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await expect(dialog.getByLabel('Name')).toHaveValue('Lathe');
  await dialog.getByLabel('Name').fill('Lathe (CNC)');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(crudRow(page, 'LATHE-02')).toContainText('Lathe (CNC)');
  await expect(crudRow(page, 'LATHE-02')).toContainText('On');
  expect(await writes(page)).toEqual([
    {
      method: 'PUT',
      path: '/gallery/machines/m-2',
      body: { code: 'LATHE-02', name: 'Lathe (CNC)', active: true },
    },
  ]);
});

test('crud: switches a machine off and on again, never deleting', async ({ page }) => {
  await open(page, 'lang=en');
  const row = crudRow(page, 'LATHE-02');
  await row.getByRole('button', { name: 'Switch off' }).click();
  await expect(row).toContainText('Off');
  await expect(row.getByRole('button', { name: 'Switch on' })).toBeVisible();
  await expect(page.getByTestId('gallery-crud').locator('tbody tr')).toHaveCount(3);
  await row.getByRole('button', { name: 'Switch on' }).click();
  await expect(row.getByRole('button', { name: 'Switch off' })).toBeVisible();
  await expect(row).toContainText('On');
  const put = (active: boolean) => ({
    method: 'PUT',
    path: '/gallery/machines/m-2',
    body: { code: 'LATHE-02', name: 'Lathe', active },
  });
  expect(await writes(page)).toEqual([put(false), put(true)]);
  const methods = (await crudRequests(page)).map((r) => r.method);
  expect(methods).not.toContain('DELETE');
  expect(methods.every((m) => ['GET', 'POST', 'PUT'].includes(m))).toBe(true);
});

test("crud: shows the API's refusal and keeps the data", async ({ page }) => {
  await open(page, 'lang=en');
  const crud = page.getByTestId('gallery-crud');
  await crudRow(page, 'DRILL-01').getByRole('button', { name: 'Switch on' }).click();
  await expect(crud.getByRole('alert')).toContainText(SAVE_ERROR);
  await expect(crudRow(page, 'DRILL-01')).toContainText('Off');
  await crud.getByRole('button', { name: 'Add', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Code').fill('CNC-07');
  await dialog.getByLabel('Name').fill('Duplicate');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText(SAVE_ERROR);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(crud.locator('tbody tr')).toHaveCount(3);
  await expect(crud.getByRole('alert')).toContainText('Could not save');
  expect(await writes(page)).toEqual([
    {
      method: 'PUT',
      path: '/gallery/machines/m-3',
      body: { code: 'DRILL-01', name: 'Radial drill', active: true },
    },
    { method: 'POST', path: '/gallery/machines', body: { code: 'CNC-07', name: 'Duplicate' } },
  ]);
});

for (const lang of ['en', 'gu']) {
  test(`crud ${lang}: the generated page matches its baseline at 360 px, axe clean`, async ({
    page,
  }) => {
    await open(page, `lang=${lang}`);
    const crud = page.getByTestId('gallery-crud');
    await expect(crud.getByRole('button', { name: 'Add', exact: true })).toBeVisible();
    await expect(crud.getByRole('columnheader').first()).toContainText(
      lang === 'en' ? 'Code' : 'ક ખ ગ · Code',
    );
    await expect(crud).toHaveScreenshot(`crud-${lang}.png`);
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(axe.violations).toEqual([]);
  });

  test(`wizard ${lang}: one primary action per step, back, then the result screen`, async ({
    page,
  }) => {
    await open(page, `lang=${lang}`);
    const w = page.getByTestId('gallery-wizard-ready');
    const btn = (name: string | RegExp) => w.getByRole('button', { name });
    await expect(page.getByTestId('gallery-wizard')).toHaveScreenshot(`wizard-${lang}.png`);
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(axe.violations).toEqual([]);
    await expect(w).toContainText('Step 1 of 3');
    await expect(btn(/Next/)).toBeDisabled();
    await btn('CNC-07').click();
    await expect(btn('CNC-07')).toHaveAttribute('aria-pressed', 'true');
    await expect(btn(/Next/)).toBeEnabled();
    await btn(/Next/).click();
    await expect(w).toContainText('Step 2 of 3');
    await expect(w.getByRole('heading', { name: /What is wrong\?/ })).toBeFocused();
    await btn(/Back/).click();
    await expect(w).toContainText('Step 1 of 3');
    await expect(btn('CNC-07')).toHaveAttribute('aria-pressed', 'true');
    await btn(/Next/).click();
    await btn(/Spindle noise on start-up/).click();
    await btn(/Next/).click();
    await expect(w).toContainText('Step 3 of 3');
    await expect(w).toContainText('CNC-07 ·');
    await expect(w).toContainText('Spindle noise on start-up');
    await btn(/Send/).click();
    await expect(w).toContainText('Sent. The maintenance team has been told.');
    await expect(btn(/Send/)).toHaveCount(0);
    await expect(btn(/Next/)).toHaveCount(0);
    const result = w.getByText('Sent. The maintenance team has been told.');
    expect(await result.evaluate((el) => el.parentElement === document.activeElement)).toBe(true);
  });
}

test('wizard: a refused send shows the error; offline it needs a connection', async ({ page }) => {
  await open(page, 'lang=en');
  const e = page.getByTestId('gallery-wizard-error');
  await e.getByRole('button', { name: /Send/ }).click();
  await expect(e.getByRole('alert')).toContainText('Could not send. Try again.');
  await expect(e.getByRole('button', { name: /Send/ })).toBeEnabled();
  const o = page.getByTestId('gallery-wizard-offline');
  await expect(o).toContainText('You are offline. Connect to send this.');
  await expect(o.getByRole('button', { name: /Send/ })).toBeDisabled();
  await expect(o.getByTestId('sync-status')).toHaveText(/Offline/);
});

for (const lang of ['en', 'gu']) {
  test(`board ${lang}: groups, tiles and every state at 360 px, axe clean`, async ({ page }) => {
    await open(page, `lang=${lang}`);
    const at = (id: string) => page.getByTestId(id);
    const ready = at('gallery-board-ready');
    for (const name of ['Stopped (2)', 'In progress (2)', 'Waiting (1)'])
      await expect(ready.getByRole('heading', { name })).toBeVisible();
    await expect(ready.locator('li')).toHaveCount(5);
    await expect(ready.getByRole('button', { name: /All segments/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(at('gallery-board-loading')).toContainText('Loading…');
    await expect(at('gallery-board-empty')).toContainText('No machines need attention.');
    await expect(
      at('gallery-board-empty').getByRole('button', { name: /All segments/ }),
    ).toBeVisible();
    await expect(at('gallery-board-error').getByRole('alert')).toContainText(
      'Could not load. Try again.',
    );
    await expect(
      at('gallery-board-error').getByRole('button', { name: /Try again/ }),
    ).toBeVisible();
    await expect(at('gallery-board-offline')).toContainText(
      'You are offline. This will load when you reconnect.',
    );
    await expect(at('gallery-board-offline').getByTestId('sync-status')).toHaveText(/Offline/);
    await expect(at('gallery-board')).toHaveScreenshot(`board-${lang}.png`);
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(axe.violations).toEqual([]);
  });
}

test('board: filters by segment', async ({ page }) => {
  await open(page, 'lang=en');
  const b = page.getByTestId('gallery-board-ready');
  await b.getByRole('button', { name: /Conventional/ }).click();
  await expect(b.getByRole('button', { name: /Conventional/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(b.getByRole('button', { name: /All segments/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(b.locator('li')).toHaveCount(2);
  await expect(b).toContainText('BD-0102');
  await expect(b).toContainText('BD-0104');
  await expect(b.getByRole('heading', { name: 'Waiting (0)' })).toBeVisible();
  await b.getByRole('button', { name: /CNC/ }).click();
  await expect(b.locator('li')).toHaveCount(3);
});

for (const lang of ['en', 'gu']) {
  test(`dashboard ${lang}: KPI tiles, two charts and every state at 360 px, axe clean`, async ({
    page,
  }) => {
    await open(page, `lang=${lang}`);
    const at = (id: string) => page.getByTestId(id);
    const d = at('gallery-dashboard-ready');
    await expect(d.getByRole('link', { name: /Open tickets/ })).toContainText('5');
    for (const text of ['Machines stopped', '2', 'Mean time to repair (h:mm)', '1:40'])
      await expect(d).toContainText(text);
    await expect(d.locator('[data-chart-state="ready"]')).toHaveCount(2, { timeout: 10_000 });
    await expect(d.getByRole('img', { name: /Breakdowns by segment this week/ })).toBeVisible();
    await expect(d.getByRole('img', { name: /Downtime hours per week/ })).toBeVisible();
    await expect(at('gallery-dashboard-loading')).toContainText('Loading…');
    await expect(at('gallery-dashboard-error').getByRole('alert')).toContainText(
      'Could not load. Try again.',
    );
    await expect(
      at('gallery-dashboard-error').getByRole('button', { name: /Try again/ }),
    ).toBeVisible();
    await expect(at('gallery-dashboard-offline')).toContainText(
      'You are offline. This will load when you reconnect.',
    );
    await expect(at('gallery-dashboard')).toHaveScreenshot(`dashboard-${lang}.png`);
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(axe.violations).toEqual([]);
  });
}

const downtimeChart = (page: Page) =>
  page
    .getByTestId('gallery-dashboard-ready')
    .locator('figure', { hasText: 'Downtime hours per week' });

test('dashboard: charts never rely on colour alone and carry their numbers', async ({ page }) => {
  await open(page, 'lang=en');
  const line = downtimeChart(page);
  await expect(line.locator('[data-chart-state="ready"]')).toHaveCount(1, { timeout: 10_000 });
  expect(await line.locator('path[stroke-dasharray]').count()).toBeGreaterThan(0);
  for (const name of ['Conventional', 'CNC'])
    expect(await line.locator('svg text', { hasText: name }).count()).toBeGreaterThanOrEqual(1);
  await line.getByText('Show the numbers', { exact: true }).click();
  const table = line.getByRole('table');
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader')).toHaveText(['Week', 'CNC', 'Conventional']);
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(6);
  await expect(rows.first().locator('th, td')).toHaveText(['W41', '12', '5']);
});

test('dashboard: a KPI tile drills down to its target', async ({ page }) => {
  await open(page, 'lang=gu');
  await page
    .getByTestId('gallery-dashboard-ready')
    .getByRole('link', { name: /Open tickets/ })
    .click();
  await expect(page).toHaveURL(/\/gallery\?lang=gu#gallery-queue-h$/);
  await expect(page.locator('#gallery-queue-h')).toBeInViewport();
  await expect(page.getByTestId('gallery-root')).toBeVisible();
});

test('dashboard: chart colours come from the tokens', async ({ page }) => {
  for (const [accent, hex] of [
    ['teal', '#0d9488'],
    ['blue', '#0a66c2'],
  ]) {
    await open(page, `lang=en&accent=${accent}`);
    const line = downtimeChart(page);
    await expect(line.locator('[data-chart-state="ready"]')).toHaveCount(1, { timeout: 10_000 });
    expect(
      await line.locator(`path[stroke="${hex}"]:not([stroke-dasharray])`).count(),
    ).toBeGreaterThanOrEqual(1);
  }
});
