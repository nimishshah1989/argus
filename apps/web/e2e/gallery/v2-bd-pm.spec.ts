import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
test.use({ trace: 'retain-on-failure' });

const drawer = (page: Page) => page.locator('aside.v2-drawer');

async function open(page: Page, theme = 'light') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-bd-pm&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1, name: 'BD % and PM split' })).toBeVisible();
  await expect(
    page.getByText(
      'Breakdowns took 3,060.1 hrs (0.54% of available) and PM took 759.3 hrs (0.13% of available). Fleet availability is 99.32%.',
    ),
  ).toBeVisible();
}

/** A chip in a table opens its thing in the drawer, which lives in the URL; Back closes it. */
async function chipOpensDrawer(page: Page, region: string, chip: string, url: RegExp) {
  await page
    .getByRole('region', { name: region, exact: true })
    .getByRole('button', { name: chip, exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(url);
  await expect(drawer(page)).not.toHaveAttribute('inert', '');
  await page.goBack();
  await expect(drawer(page)).toHaveAttribute('inert', '');
}

test('BD % and PM split: six figures, two charts and the five tables are up; a cell chip opens the drawer', async ({
  page,
}) => {
  await open(page);
  // Figures past the fourth fold under "Show detail" (sweep #706); a no-op before the fold lands.
  for (const s of await page.locator('details.v2-show-detail:not([open]) > summary').all())
    await s.click();
  for (const label of [
    'Avg Available Hrs / Machine',
    'Total Machines',
    'Actual Breakdown',
    'PM Downtime',
    'Fleet Availability',
  ])
    await expect(page.getByRole('region', { name: label, exact: true })).toBeVisible();
  await expect(page.locator('[data-chart-state]')).toHaveCount(2);
  for (const chart of await page.locator('[data-chart-state]').all())
    await expect(chart).toHaveAttribute('data-chart-state', 'ready');
  for (const title of [
    'Month-on-Month — BD % and PM % (2026) · BD %',
    'Month-on-Month — BD % and PM % (2026) · PM %',
  ])
    await expect(page.getByRole('region', { name: title, exact: true })).toBeVisible();
  await chipOpensDrawer(page, 'By Cell — Detail', 'Cell 1', /[?&]drawer=cell:Cell(%20| )1$/);
});

test('BD % and PM split: the second measure sits under its own month', async ({ page }) => {
  await open(page);
  const pm = page.getByRole('region', {
    name: 'Month-on-Month — BD % and PM % (2026) · PM %',
    exact: true,
  });
  await expect(pm.locator('tbody tr').first().locator('td').nth(2)).toHaveText('0.00%');
  await expect(pm.locator('tbody tr').first().locator('td').nth(3)).toHaveText('0.21%');
});

for (const theme of ['light', 'dark']) {
  test(`BD % and PM split: axe finds nothing in ${theme}`, async ({ page }) => {
    await open(page, theme);
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
