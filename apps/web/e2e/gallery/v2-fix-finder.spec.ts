import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
test.use({ trace: 'retain-on-failure' });

const drawer = (page: Page) => page.locator('aside.v2-drawer');

async function open(page: Page, theme = 'light') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-fix-finder&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Fix Finder' })).toBeVisible();
  await expect(
    page.getByText('57 similar breakdowns found, typically down 1.3 hrs.'),
  ).toBeVisible();
}

test('Fix Finder: the engine figures are up, a machine chip opens the drawer, Back closes it', async ({
  page,
}) => {
  await open(page);
  for (const label of ['Similar cases', 'On this machine', 'Typical downtime', 'Last seen'])
    await expect(page.getByRole('region', { name: label, exact: true })).toBeVisible();
  const cases = page.getByRole('region', { name: 'Similar breakdowns across the plant' });
  await expect(cases.locator('tbody tr')).toHaveCount(10);
  await cases.getByRole('button', { name: 'VC-38', exact: true }).first().click();
  await expect(page).toHaveURL(/[?&]drawer=machine:VC-38$/);
  await expect(drawer(page)).not.toHaveAttribute('inert', '');
  await page.goBack();
  await expect(drawer(page)).toHaveAttribute('inert', '');
});

test('Fix Finder: Down hrs sorts both ways and the filter chips narrow the list', async ({
  page,
}) => {
  await open(page);
  const cases = page.getByRole('region', { name: 'Similar breakdowns across the plant' });
  const down = cases.getByRole('columnheader', { name: /Down \(hrs\)/ });
  await down.getByRole('button').click();
  await expect(down).toHaveAttribute('aria-sort', 'descending');
  await down.getByRole('button').click();
  await expect(down).toHaveAttribute('aria-sort', 'ascending');
  await cases.getByRole('button', { name: '100% match', exact: true }).click();
  await expect(cases.getByText('1–6 of 6')).toBeVisible();
});

for (const theme of ['light', 'dark']) {
  test(`Fix Finder: axe finds nothing in ${theme}, with the drawer open`, async ({ page }) => {
    await open(page, theme);
    await page
      .getByRole('region', { name: 'Similar breakdowns across the plant' })
      .getByRole('button', { name: 'VC-38', exact: true })
      .first()
      .click();
    await expect(drawer(page)).not.toHaveAttribute('inert', '');
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
