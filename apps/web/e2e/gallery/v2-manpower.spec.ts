import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
test.use({ trace: 'retain-on-failure' });

const drawer = (page: Page) => page.locator('aside.v2-drawer');

async function open(page: Page, theme = 'light') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-manpower&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Manpower' })).toBeVisible();
  await expect(
    page.getByText('Person 11 handled the most breakdowns: 197 of 1279 (15.40%).'),
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

test('Manpower: three figures, the chart and six tables are up; a person chip opens the drawer', async ({
  page,
}) => {
  await open(page);
  for (const label of ['Total Breakdowns', 'Total BD Hours', 'Team Members Tracked'])
    await expect(page.getByRole('region', { name: label, exact: true })).toBeVisible();
  await expect(page.locator('[data-chart-state]')).toHaveCount(1);
  await expect(page.locator('[data-chart-state]')).toHaveAttribute('data-chart-state', 'ready');
  await expect(page.getByRole('region', { name: 'Specialization', exact: true })).toBeVisible();
  await chipOpensDrawer(page, 'Manpower Table', 'Person 11', /[?&]drawer=person:person-11$/);
});

test('Manpower: the type chips narrow the table to vendors', async ({ page }) => {
  await open(page);
  const table = page.getByRole('region', { name: 'Manpower Table', exact: true });
  await table.getByRole('button', { name: 'Vendor', exact: true }).click();
  await expect(table.locator('tbody tr').first()).toContainText('Vendor');
});

test('Manpower: the Specialization toggle keeps v1’s fault-code form, which says it is not computed', async ({
  page,
}) => {
  await open(page);
  const toggle = page.getByRole('group', { name: 'Specialization view', exact: true });
  await expect(toggle.getByRole('button', { name: 'By Category', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('columnheader', { name: 'Turning Cen…', exact: true })).toBeVisible();
  await toggle.getByRole('button', { name: 'By Fault Code', exact: true }).click();
  await expect(page.getByText('Not computed yet', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Turning Cen…', exact: true })).toHaveCount(
    0,
  );
  await toggle.getByRole('button', { name: 'By Category', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Turning Cen…', exact: true })).toBeVisible();
});

for (const theme of ['light', 'dark']) {
  test(`Manpower: axe finds nothing in ${theme}`, async ({ page }) => {
    await open(page, theme);
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
