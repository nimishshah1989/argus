import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const WIDTHS = [1440, 390];

async function open(page: Page, width: number, theme = 'light') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/gallery?view=v2-dashboard&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('9% worse');
}

for (const width of WIDTHS) {
  test.describe(`${width} px`, () => {
    test('the verdict and a decision open their Why to bullet points', async ({ page }) => {
      await open(page, width);
      const verdictWhy = page.locator('header').getByRole('button', { name: 'Why?' });
      await expect(verdictWhy).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByText('Biggest jump:')).toHaveCount(0);
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
    });

    test('an action shows its done text and the count follows', async ({ page }) => {
      await open(page, width);
      await expect(page.getByText('4 waiting · biggest first')).toBeVisible();
      await page.getByRole('button', { name: 'Get an overhaul quote' }).click();
      await expect(page.getByRole('button', { name: 'Quote requested' })).toBeVisible();
      await expect(page.getByText('1 of 4 decided')).toBeVisible();
    });

    test('a tapped machine opens its panel and the Down filter keeps only machines that are down', async ({
      page,
    }) => {
      await open(page, width);
      await expect(page.getByText('Tap any square to see why')).toBeVisible();
      await page.getByRole('button', { name: 'TC-4, Cell 1: Broken down' }).click();
      await expect(page.getByText('Down for 2 h 40 min')).toBeVisible();
      await expect(page.getByText('Tap any square to see why')).toHaveCount(0);

      const down = page
        .getByRole('group', { name: 'Show machines' })
        .getByRole('button', { name: 'Down' });
      await down.click();
      await expect(down).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', { name: 'TC-4, Cell 1: Broken down' })).toHaveAttribute(
        'data-dim',
        'false',
      );
      await expect(page.getByRole('button', { name: 'TC-1, Cell 1: Running' })).toHaveAttribute(
        'data-dim',
        'true',
      );
    });

    test('the page never scrolls sideways', async ({ page }) => {
      await open(page, width);
      await page.locator('header').getByRole('button', { name: 'Why?' }).click();
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(wide).toBe(false);
    });
  });
}

for (const theme of ['light', 'dark']) {
  test(`axe finds nothing in ${theme}, with explanations open`, async ({ page }) => {
    await open(page, 1440, theme);
    for (const why of await page.getByRole('button', { name: /^Why/ }).all()) await why.click();
    await page.getByRole('button', { name: 'TC-4, Cell 1: Broken down' }).click();
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
