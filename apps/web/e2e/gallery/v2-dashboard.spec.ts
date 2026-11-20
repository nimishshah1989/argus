import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const AXIS = 'Stop axis motor and encoder failures';
const drawer = (page: Page) => page.locator('aside.v2-drawer');

async function open(page: Page, width: number, theme = 'light') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/gallery?view=v2-dashboard&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('November is')).toBeVisible();
}

for (const width of [1440, 390]) {
  test(`${width} px: a decision opens the drawer, Esc closes it, a table filter works, nothing scrolls sideways`, async ({
    page,
  }) => {
    await open(page, width);
    await page.getByRole('button', { name: AXIS }).click();
    await expect(drawer(page)).toHaveAttribute('aria-label', AXIS);
    await expect(drawer(page).getByText('The full story')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toHaveAttribute('inert', '');
    const table = page.getByRole('region', { name: 'Machines' });
    await expect(table.getByText('1–10 of 126')).toBeVisible();
    await table.getByRole('searchbox', { name: 'Search 126 machines' }).fill('grinder');
    await expect(table.getByText('1–10 of 12')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });
}

for (const theme of ['light', 'dark']) {
  test(`axe finds nothing in ${theme}, with the Whys and the drawer open`, async ({ page }) => {
    await open(page, 1440, theme);
    for (const why of await page.getByRole('button', { name: /^Why/ }).all()) await why.click();
    await page.getByRole('button', { name: AXIS }).click();
    await expect(drawer(page)).toHaveAttribute('aria-label', AXIS);
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
