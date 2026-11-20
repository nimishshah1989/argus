import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BEARING = 'Keep a spare spindle bearing for the turning centres';
const drawer = (page: Page) => page.locator('aside.v2-drawer');

async function open(page: Page, width: number, theme = 'light', extra = '') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-action-center&theme=${theme}${extra}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Action Center' })).toBeVisible();
  await expect(page.locator('.v2-lede').getByText('7 decisions are waiting')).toBeVisible();
}

for (const width of [1440, 390]) {
  test(`${width} px: a decision opens the drawer, Back closes it, the table filters, nothing scrolls sideways`, async ({
    page,
  }) => {
    await open(page, width);
    await page.getByRole('button', { name: BEARING }).click();
    await expect(drawer(page)).toHaveAttribute('aria-label', BEARING);
    await expect(page).toHaveURL(/drawer=decision:bearing/);
    await page.goBack();
    await expect(drawer(page)).toHaveAttribute('inert', '');
    const table = page.getByRole('region', { name: 'Machines that keep coming up' });
    await expect(table.getByText('1–10 of 13')).toBeVisible();
    await table.getByRole('button', { name: 'Has a high nudge' }).click();
    await expect(table.getByText('1–5 of 5')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });
}

test('a machine in the table opens its drawer; a parked decision opens without a Decide button', async ({
  page,
}) => {
  await open(page, 1440);
  await page.getByRole('button', { name: 'Open GRD-127' }).click();
  await expect(drawer(page)).toHaveAttribute('aria-label', 'Grinder 127');
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Check the hydraulic oil on the vertical centres' })
    .click();
  await expect(drawer(page)).toHaveAttribute('aria-label', /hydraulic oil/);
  await expect(drawer(page).locator('[aria-pressed]')).toHaveCount(0);
});

for (const theme of ['light', 'dark']) {
  test(`axe finds nothing in ${theme}, with the Whys and a drawer open`, async ({ page }) => {
    await open(page, 1440, theme);
    for (const why of await page.getByRole('button', { name: /^Why/ }).all()) await why.click();
    await page.getByRole('button', { name: BEARING }).click();
    await expect(drawer(page)).toHaveAttribute('aria-label', BEARING);
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}

test('the loading, empty and error states are designed', async ({ page }) => {
  for (const [state, marker] of [
    ['loading', '[data-state="loading"]'],
    ['empty', '[data-state="empty"]'],
    ['error', '[data-state="error"]'],
  ] as const) {
    await page.goto(`/gallery?view=v2-action-center&state=${state}`);
    await expect(page.locator(marker)).toBeVisible();
  }
});
