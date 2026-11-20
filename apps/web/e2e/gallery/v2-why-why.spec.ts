import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
test.use({ trace: 'retain-on-failure' });

const drawer = (page: Page) => page.locator('aside.v2-drawer');

async function open(page: Page, theme = 'light') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-why-why&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Why-Why' })).toBeVisible();
  await expect(
    page.getByText('24 breakdowns ran past the Why-Why limit: 0 have a Why-Why, 24 are waiting.'),
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

test('Why-Why: the candidates are listed with their status; a machine chip opens the drawer', async ({
  page,
}) => {
  await open(page);
  const table = page.getByRole('region', {
    name: 'Breakdowns that ran past the Why-Why limit',
    exact: true,
  });
  await expect(table.locator('tbody tr')).toHaveCount(10);
  await expect(table.getByText('1–10 of 24')).toBeVisible();
  await expect(table.locator('tbody tr').first()).toContainText('Not Started');
  await expect(page.getByRole('link', { name: 'Open the current Why-Why page.' })).toBeVisible();
  await chipOpensDrawer(
    page,
    'Breakdowns that ran past the Why-Why limit',
    'TMC-2',
    /[?&]drawer=machine:TMC-2$/,
  );
});

test('Why-Why: the Completed filter says so when nothing is done yet', async ({ page }) => {
  await open(page);
  const table = page.getByRole('region', {
    name: 'Breakdowns that ran past the Why-Why limit',
    exact: true,
  });
  await table.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(table.getByText('Nothing matches this filter.')).toBeVisible();
});

for (const theme of ['light', 'dark']) {
  test(`Why-Why: axe finds nothing in ${theme}`, async ({ page }) => {
    await open(page, theme);
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
