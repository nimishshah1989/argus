import { expect, test, type Page } from '@playwright/test';

/**
 * The `v2-dashboard` gallery view where gallery/v2-dashboard.spec.ts does not look: a tablet width, the dark theme on a
 * phone, and a decision opened from its address (a reload, or a shared link, lands with the drawer already open).
 */
const AXIS = 'Stop axis motor and encoder failures';
const drawer = (page: Page) => page.locator('aside.v2-drawer');
const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > innerWidth);

async function open(page: Page, width: number, theme: string, extra = '') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/gallery?view=v2-dashboard&theme=${theme}${extra}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('November is')).toBeVisible();
}

for (const [width, theme] of [
  [768, 'light'],
  [390, 'dark'],
] as const) {
  test(`${width} px in ${theme}: nothing scrolls sideways and the machine table pages`, async ({
    page,
  }) => {
    await open(page, width, theme);
    expect(await sideways(page)).toBe(false);
    const table = page.getByRole('region', { name: 'Machines' });
    await expect(table.getByText('1–10 of 126')).toBeVisible();
    await table.getByRole('searchbox', { name: 'Search 126 machines' }).fill('grinder');
    await expect(table.getByText('1–10 of 12')).toBeVisible();
  });
}

test('a decision’s address opens its drawer; Esc closes it and the address is clean again', async ({
  page,
}) => {
  await open(page, 1440, 'light', '&drawer=decision:axis');
  await expect(drawer(page)).toHaveAttribute('aria-label', AXIS);
  await expect(drawer(page).getByText('The full story')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer(page)).toHaveAttribute('inert', '');
  await expect(page).not.toHaveURL(/drawer=/);
});
