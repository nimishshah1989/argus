import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openShowDetail } from '../show-detail.js';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
test.use({ trace: 'retain-on-failure' });

const drawer = (page: Page) => page.locator('aside.v2-drawer');

async function open(page: Page, theme = 'light') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-problem-analysis&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Problem Analysis' })).toBeVisible();
  await expect(page.getByText('Axis motor costs the most: 15.85% of all hours.')).toBeVisible();
}

test('Problem Analysis: eight figures, two charts and the tables are up; a machine chip opens the drawer', async ({
  page,
}) => {
  await open(page);
  // The what-if figures sit behind their own fold (ADR 0049); the charts are kit pieces (ADR 0043).
  await openShowDetail(page, page.getByRole('region', { name: 'Breakdowns studied', exact: true }));
  for (const label of ['Breakdowns studied', 'Repeat problems', 'Downtime saved', 'MTBF'])
    await expect(page.getByRole('region', { name: label, exact: true })).toBeVisible();
  await expect(page.locator('ol.v2-ranked')).toBeVisible();
  await expect(page.locator('svg.v2-quad')).toBeVisible();
  const repeats = page.getByRole('region', { name: 'Repeat offenders' });
  await expect(repeats.locator('tbody tr')).toHaveCount(10);
  await repeats.getByRole('button', { name: 'TC-5', exact: true }).first().click();
  await expect(page).toHaveURL(/[?&]drawer=machine:TC-5$/);
  await expect(drawer(page)).not.toHaveAttribute('inert', '');
  await page.goBack();
  await expect(drawer(page)).toHaveAttribute('inert', '');
});

test('Problem Analysis: the groups table sorts by hours and the family chips narrow it', async ({
  page,
}) => {
  await open(page);
  const groups = page.getByRole('region', { name: 'All problem groups' });
  const hours = groups.getByRole('columnheader', { name: /^Hours/ });
  await hours.getByRole('button').click();
  await expect(hours).toHaveAttribute('aria-sort', 'descending');
  await groups.getByRole('button', { name: 'Fluids and chips', exact: true }).click();
  await expect(groups.locator('tbody tr').first()).toContainText('Fluids and chips');
});

for (const theme of ['light', 'dark']) {
  test(`Problem Analysis: axe finds nothing in ${theme}`, async ({ page }) => {
    await open(page, theme);
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
