import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
test.use({ trace: 'retain-on-failure' });

const drawer = (page: Page) => page.locator('aside.v2-drawer');
const log = (page: Page) => page.getByRole('region', { name: 'Breakdown log', exact: true });

async function open(page: Page, theme = 'light') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-breakdown-log&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Breakdown log' })).toBeVisible();
  await expect(page.getByText('1,343 rows · Records to 11-Nov-2026')).toBeVisible();
}

test('Breakdown Log: ten of 1,343 entries are on the page, the next ten follow, and a chip opens the drawer', async ({
  page,
}) => {
  await open(page);
  const rows = log(page).locator('tbody tr');
  await expect(rows).toHaveCount(10);
  await expect(log(page).getByText('1–10 of 1,343')).toBeVisible();
  await expect(rows.first().getByRole('cell').first()).toHaveText('1357');
  await log(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(log(page).getByText('11–20 of 1,343')).toBeVisible();
  await expect(rows).toHaveCount(10);
  await expect(rows.first().getByRole('cell').first()).toHaveText('1347');
  await log(page)
    .getByRole('button', { name: /^VC-\d+$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/[?&]drawer=machine:VC-/);
  await expect(drawer(page)).not.toHaveAttribute('inert', '');
  await page.goBack();
  await expect(drawer(page)).toHaveAttribute('inert', '');
});

test('Breakdown Log: a filter narrows the pages, keeps the count of the whole log and a sort puts dashes last', async ({
  page,
}) => {
  await open(page);
  await log(page).getByLabel('Shift', { exact: true }).selectOption('2');
  await expect(log(page).getByText(/^1–10 of \d/)).toBeVisible();
  await expect(log(page).getByText(/The log holds 1,343 entries/)).toBeVisible();
  const hours = log(page).getByRole('columnheader', { name: /Downtime/ });
  await hours.getByRole('button').click();
  await expect(hours).toHaveAttribute('aria-sort', 'descending');
  await expect(log(page).locator('tbody tr')).toHaveCount(10);
  await expect(log(page).locator('tbody tr td:nth-child(8)', { hasText: '—' })).toHaveCount(0);
});

for (const theme of ['light', 'dark']) {
  test(`Breakdown Log: axe finds nothing in ${theme}`, async ({ page }) => {
    await open(page, theme);
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
