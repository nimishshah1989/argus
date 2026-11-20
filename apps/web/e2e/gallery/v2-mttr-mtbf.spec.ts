import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
test.use({ trace: 'retain-on-failure' });

const drawer = (page: Page) => page.locator('aside.v2-drawer');

async function open(page: Page, theme = 'light') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-mttr-mtbf&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1, name: 'MTTR and MTBF' })).toBeVisible();
  await expect(
    page.getByText(
      'A breakdown takes 2.39 hrs to fix on average, and a machine runs 439.9 hrs between breakdowns.',
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

test('MTTR and MTBF: seven charts, eight tables and the 125 machines; a machine chip opens the drawer', async ({
  page,
}) => {
  await open(page);
  await expect(page.locator('[data-chart-state]')).toHaveCount(7);
  for (const chart of await page.locator('[data-chart-state]').all())
    await expect(chart).toHaveAttribute('data-chart-state', 'ready');
  const machines = page.getByRole('region', { name: 'By Individual Machine', exact: true });
  await expect(machines.getByText('1–10 of 125')).toBeVisible();
  await expect(
    page.getByRole('region', {
      name: 'Month-on-Month MTTR & MTBF — Cell-wise and Plant-wide · MTBF',
      exact: true,
    }),
  ).toBeVisible();
  await chipOpensDrawer(page, 'By Individual Machine', 'TMC-2', /[?&]drawer=machine:TMC-2$/);
});

test('MTTR and MTBF: the machine table sorts by MTTR', async ({ page }) => {
  await open(page);
  const machines = page.getByRole('region', { name: 'By Individual Machine', exact: true });
  const mttr = machines.getByRole('columnheader', { name: /^MTTR/ });
  await mttr.getByRole('button').click();
  await expect(mttr).toHaveAttribute('aria-sort', 'descending');
});

for (const theme of ['light', 'dark']) {
  test(`MTTR and MTBF: axe finds nothing in ${theme}`, async ({ page }) => {
    await open(page, theme);
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
