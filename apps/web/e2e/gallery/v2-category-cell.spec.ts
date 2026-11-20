import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
test.use({ trace: 'retain-on-failure' });

const drawer = (page: Page) => page.locator('aside.v2-drawer');

async function open(page: Page, theme = 'light') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-category-cell&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Category and cell' })).toBeVisible();
  await expect(
    page.getByText(
      'Vertical Machining Center has the most breakdown hours: 1,057.79 hrs, 34.57% of the total.',
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

test('Category and cell: eight charts, the summary tables and one table of 125 machines; a machine chip opens the drawer', async ({
  page,
}) => {
  await open(page);
  await expect(page.locator('[data-chart-state]')).toHaveCount(8);
  for (const chart of await page.locator('[data-chart-state]').all())
    await expect(chart).toHaveAttribute('data-chart-state', 'ready');
  const machines = page.getByRole('region', { name: 'Machine-Level Detail', exact: true });
  await expect(machines.locator('tbody tr')).toHaveCount(10);
  await expect(machines.getByText('1–10 of 125')).toBeVisible();
  await chipOpensDrawer(page, 'Machine-Level Detail', 'TC-5', /[?&]drawer=machine:TC-5$/);
});

test('Category and cell: a category chip narrows the machines to it', async ({ page }) => {
  await open(page);
  const machines = page.getByRole('region', { name: 'Machine-Level Detail', exact: true });
  await machines.getByRole('button', { name: 'Turning Center', exact: true }).first().click();
  await expect(machines.getByText('1–10 of 38')).toBeVisible();
});

for (const theme of ['light', 'dark']) {
  test(`Category and cell: axe finds nothing in ${theme}`, async ({ page }) => {
    await open(page, theme);
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
