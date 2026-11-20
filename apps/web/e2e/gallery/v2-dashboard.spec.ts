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

const tile = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('a decision action is pressed, shows its done text, is announced, and can be undone', async ({
  page,
}) => {
  await open(page, 1440);
  const count = page.locator('[aria-live="polite"]').filter({ hasText: 'waiting' });
  await expect(count).toHaveText('4 waiting · biggest first');
  const act = page.getByRole('button', { name: 'Assign a root-cause fix' });
  await expect(act).toHaveAttribute('aria-pressed', 'false');
  await act.click();
  const done = page.getByRole('button', { name: 'Assigned to Arjun V' });
  await expect(done).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('1 of 4 decided')).toBeVisible();
  await done.click();
  await expect(page.getByRole('button', { name: 'Assign a root-cause fix' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByText('4 waiting · biggest first')).toBeVisible();
});

test('the plant map filter disables the machines it leaves out', async ({ page }) => {
  await open(page, 1440);
  const down = page
    .getByRole('group', { name: 'Show machines' })
    .getByRole('button', { name: 'Down' });
  await down.click();
  await expect(down).toHaveAttribute('aria-pressed', 'true');
  await expect(tile(page, 'TC-4, Cell 1: Broken down')).toBeEnabled();
  await expect(tile(page, 'TC-1, Cell 1: Running')).toBeDisabled();
});

test('the plant map is one tab stop; arrows move inside it, skip filtered machines, and resume after the drawer', async ({
  page,
}) => {
  await open(page, 1440);
  const map = page.getByRole('group', { name: 'Machines by cell' });
  await expect(map.locator('[tabindex="0"]')).toHaveCount(1);
  await tile(page, 'TC-1, Cell 1: Running').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tile(page, 'TC-2, Cell 1: Running')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(tile(page, 'VC-17, Cell 2: In PM')).toBeFocused();
  await tile(page, 'VC-24, Cell 2: At risk').click();
  await expect(drawer(page)).toHaveAttribute('aria-label', 'Vertical machining centre 24');
  await page.keyboard.press('Escape');
  await expect(tile(page, 'VC-24, Cell 2: At risk')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tile(page, 'VC-25, Cell 2: Running')).toBeFocused();
  await page
    .getByRole('group', { name: 'Show machines' })
    .getByRole('button', { name: 'Down' })
    .click();
  await map.locator('[tabindex="0"]').focus();
  await expect(tile(page, 'TC-4, Cell 1: Broken down')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tile(page, 'TC-56, Cell 4: Broken down')).toBeFocused();
});

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
