import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const PALETTE = 'Search sections and screens';
const palette = (page: Page) => page.getByRole('dialog', { name: PALETTE, exact: true });
const search = (page: Page) => page.getByRole('button', { name: /^Search/ });
const rail = (page: Page) => page.getByRole('navigation', { name: 'Analytics', exact: true });

async function open(page: Page, width = 1440, theme = 'light') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/gallery?view=v2-dashboard&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('November is')).toBeVisible(); // the figures are in: the shell is the final one
  await expect(search(page)).toBeVisible();
}

test('the rail has the sections and, last, the way out to the desk', async ({ page }) => {
  await open(page);
  const links = rail(page).getByRole('link');
  await expect(links).toHaveCount(8);
  await expect(links.last()).toHaveText('Desk');
  await expect(links.last()).toHaveAttribute('href', '/desk');
  await expect(rail(page).getByRole('link', { name: 'Today', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('Ctrl K opens the search with the cursor in its box; typing narrows it; Esc closes it and focus goes back to the control', async ({
  page,
}) => {
  await open(page);
  await page.keyboard.press('Control+k');
  await expect(palette(page)).toBeVisible();
  const box = page.getByRole('combobox', { name: 'Type a section or screen name' });
  await expect(box).toBeFocused();
  await page.keyboard.type('mttr');
  await expect(palette(page).getByRole('option')).toHaveCount(1);
  await expect(palette(page).getByRole('option')).toContainText('Screen in Problems');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('zzzz');
  await expect(palette(page).getByRole('option')).toHaveCount(0);
  await expect(palette(page).getByText('Nothing matches')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(palette(page)).toHaveCount(0);
  await expect(search(page)).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(palette(page)).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(palette(page)).toHaveCount(0);
});

test('the arrows move the lit result and Tab stays in the box', async ({ page }) => {
  await open(page);
  await search(page).click();
  const options = palette(page).getByRole('option');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(options.last()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Type a section or screen name' })).toBeFocused();
});

test('a click outside the search closes it', async ({ page }) => {
  await open(page);
  await search(page).click();
  await expect(palette(page)).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(palette(page)).toHaveCount(0);
});

test('Back closes the search that was open, and does not leave it over the page it returns to', async ({
  page,
}) => {
  await open(page);
  await page
    .locator('article.v2-decision')
    .first()
    .getByRole('button', { name: 'VC-67', exact: true })
    .click();
  await expect(page).toHaveURL(/drawer=machine:VC-67$/);
  // The drawer showing is the page having taken the new address; only then is the search opened over it.
  await expect(page.locator('aside.v2-drawer')).toHaveAttribute(
    'aria-label',
    'Vertical machining centre 67',
  );
  await page.keyboard.press('Control+k');
  await expect(palette(page)).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/drawer=/);
  await expect(palette(page)).toHaveCount(0);
});

test('Enter on a result goes there without loading a new document', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    (window as unknown as { stayed: boolean }).stayed = true;
  });
  await page.keyboard.press('Control+k');
  await page.keyboard.type('annual');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/analytics\/reports\?screen=annual-report$/);
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
});

test('a rail click goes through the router, and a Ctrl click keeps the browser its new tab', async ({
  page,
  context,
}) => {
  await open(page);
  await page.evaluate(() => {
    (window as unknown as { stayed: boolean }).stayed = true;
  });
  const popup = context.waitForEvent('page');
  await rail(page)
    .getByRole('link', { name: 'Reports', exact: true })
    .click({ modifiers: ['Control'] });
  await (await popup).close();
  await expect(page).toHaveURL(/view=v2-dashboard/);
  await rail(page).getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page).toHaveURL(/\/analytics\/reports$/);
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
});

test('on a phone the menu opens on the first section, Esc closes it, and nothing scrolls sideways', async ({
  page,
}) => {
  await open(page, 390);
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  await expect(rail(page)).toBeHidden();
  await menu.click();
  await expect(rail(page)).toBeVisible();
  await expect(rail(page).getByRole('link', { name: 'Today', exact: true })).toBeFocused();
  // Open, the menu is a modal: it is a dialog for a screen reader and the page behind it, header included, is inert.
  await expect(
    page.getByRole('dialog', { name: 'Analytics', exact: true, includeHidden: true }),
  ).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('.v2-main')).toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await expect(rail(page)).toBeHidden();
  await expect(page.locator('.v2-main')).not.toHaveAttribute('inert', '');
  await expect(menu).toBeFocused();
  await menu.click();
  await page
    .getByRole('button', { name: 'Close menu' })
    .first()
    .click({ position: { x: 360, y: 300 } });
  await expect(rail(page)).toBeHidden();
  await search(page).click();
  await expect(palette(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

for (const theme of ['light', 'dark']) {
  test(`axe finds nothing in ${theme} with the search open`, async ({ page }) => {
    await open(page, 1440, theme);
    await search(page).click();
    await expect(palette(page)).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
