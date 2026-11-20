import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const WIDTHS = [1440, 390];

async function open(page: Page, width: number, theme = 'light') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/gallery?view=v2-dashboard&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('9% worse');
}

const tile = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function whyOpens(page: Page, width: number) {
  await open(page, width);
  const verdictWhy = page.locator('header').getByRole('button', { name: 'Why?' });
  await expect(verdictWhy).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Biggest jump:')).toBeHidden();
  await verdictWhy.click();
  await expect(verdictWhy).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Biggest jump: Cell 8' }),
  ).toBeVisible();

  const turnmill = page
    .getByRole('article')
    .filter({ hasText: 'Overhaul or replace the turnmill' });
  await turnmill.getByRole('button', { name: 'Why?' }).click();
  await expect(
    turnmill.getByRole('listitem').filter({ hasText: '20 breakdowns this year' }),
  ).toBeVisible();
}

async function actionUndo(page: Page, width: number) {
  await open(page, width);
  const count = page.locator('[aria-live="polite"]').filter({ hasText: 'waiting' });
  await expect(count).toHaveText('4 waiting · biggest first');
  const act = page.getByRole('button', { name: 'Get an overhaul quote' });
  await expect(act).toHaveAttribute('aria-pressed', 'false');
  await act.click();
  const done = page.getByRole('button', { name: 'Quote requested' });
  await expect(done).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('1 of 4 decided')).toBeVisible();
  await done.click();
  await expect(page.getByRole('button', { name: 'Get an overhaul quote' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByText('4 waiting · biggest first')).toBeVisible();
}

async function tilesAndFilter(page: Page, width: number) {
  await open(page, width);
  await expect(page.getByText('Tap any square to see why')).toBeVisible();
  await tile(page, 'TC-4, Cell 1: Broken down').click();
  await expect(page.getByText('Down for 2 h 40 min')).toBeVisible();
  await expect(page.getByText('Tap any square to see why')).toHaveCount(0);

  const down = page
    .getByRole('group', { name: 'Show machines' })
    .getByRole('button', { name: 'Down' });
  await down.click();
  await expect(down).toHaveAttribute('aria-pressed', 'true');
  await expect(tile(page, 'TC-4, Cell 1: Broken down')).toBeEnabled();
  await expect(tile(page, 'TC-1, Cell 1: Running')).toBeDisabled();
}

async function noSideways(page: Page, width: number) {
  await open(page, width);
  await page.locator('header').getByRole('button', { name: 'Why?' }).click();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(wide).toBe(false);
  const label = page.locator('svg text', { hasText: 'Axis drives' });
  const px = await label.evaluate((el) => el.getBoundingClientRect().height);
  expect(px).toBeGreaterThanOrEqual(13);
}

const CHECKS: [string, (page: Page, width: number) => Promise<void>][] = [
  ['the verdict and a decision open their Why to bullet points', whyOpens],
  ['an action is pressed, shows its done text, is announced, and can be undone', actionUndo],
  [
    'a tapped machine opens its panel; the Down filter leaves only machines that are down',
    tilesAndFilter,
  ],
  ['the page never scrolls sideways and chart text stays 13 px', noSideways],
];

for (const width of WIDTHS)
  for (const [title, check] of CHECKS)
    test(`${width} px › ${title}`, ({ page }) => check(page, width));

test('the plant map is one tab stop and the arrow keys move inside it, skipping filtered machines', async ({
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
  await page.keyboard.press('ArrowRight');
  await expect(tile(page, 'VC-25, Cell 2: Running')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(map.locator(':focus')).toHaveCount(0);

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
  test(`axe finds nothing in ${theme}, with explanations open`, async ({ page }) => {
    await open(page, 1440, theme);
    for (const why of await page.getByRole('button', { name: /^Why/ }).all()) await why.click();
    await tile(page, 'TC-4, Cell 1: Broken down').click();
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
