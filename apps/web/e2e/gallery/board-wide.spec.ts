import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockPlant } from './plant-mock.js';

/**
 * The browser board at desktop widths (bug, Nimish on staging 26 Nov): the page is one stack, as the S30 wireframe's
 * browser view draws it. Every block spans the page, nothing leaves the window, the three status columns sit side by
 * side, and the age buckets and day tiles neither overlap nor wrap a word per line. No database: the API is answered
 * in the browser.
 */
const WIDTHS = [1440, 1920];

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('not laid out');
  return b;
}

async function openBoard(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 1000 });
  await mockPlant(page);
  await page.goto('/desk/board');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[data-testid^=age-]').first()).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
}

for (const width of WIDTHS) {
  test.describe(`live board at ${width} px`, () => {
    test('every block of the page spans its width and stays inside the window', async ({
      page,
    }) => {
      await openBoard(page, width);
      const main = await box(page.locator('main'));
      expect(main.x + main.width).toBeLessThanOrEqual(width);
      const blocks = await page.locator('main > *').all();
      expect(blocks.length).toBeGreaterThan(5);
      for (const block of blocks) {
        const b = await box(block);
        const label = await block.evaluate((e) => e.outerHTML.slice(0, 80));
        // Narrower than 80% of the page is a squeezed grid track, not the one-column stack.
        expect(b.width, label).toBeGreaterThan(main.width * 0.8);
        expect(b.x + b.width, label).toBeLessThanOrEqual(width);
      }
    });

    test('the three status columns sit side by side across the page', async ({ page }) => {
      await openBoard(page, width);
      const main = await box(page.locator('main'));
      const cols = await page.locator('main section:has(ul)').all();
      expect(cols).toHaveLength(3);
      const [a, b, c] = await Promise.all(cols.map(box));
      expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
      expect(Math.abs(b!.y - c!.y)).toBeLessThan(2);
      expect(c!.x + c!.width - a!.x).toBeGreaterThan(main.width * 0.8);
    });

    test('age buckets and day tiles neither overlap nor wrap word by word', async ({ page }) => {
      await openBoard(page, width);
      const buckets = await Promise.all((await page.locator('main dl > div').all()).map(box));
      expect(buckets).toHaveLength(4);
      for (let i = 1; i < buckets.length; i++)
        expect(buckets[i]!.x).toBeGreaterThanOrEqual(buckets[i - 1]!.x + buckets[i - 1]!.width);
      for (const label of await page.locator('main dl dt').all()) {
        const line = await label.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
        expect((await box(label)).height).toBeLessThan(line * 1.5);
      }
      const tiles = await page.locator('main [role=group]').all();
      expect(tiles.length).toBeGreaterThan(1);
      for (const tile of tiles) expect((await box(tile)).width).toBeGreaterThan(200);
    });
  });
}
