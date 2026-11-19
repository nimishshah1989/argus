import { expect, test, type Page } from '@playwright/test';
import { controlOrder } from './desk-mock.js';
import { PHONE, WIDE } from './board-settings-order-data.js';
import { mockPlant } from './plant-mock.js';

/**
 * LOCK.md rule 1 (ticket 88b): the new look never moves a control on the live board, the TV view or a Settings
 * screen. These lists were read off the screens BEFORE the restyle (the invented plant of `plant-mock.ts`) and are
 * written out in full: a restyle that reorders, adds or drops a control, a tab or a heading fails here. The
 * Translations screen is left out (984 key fields). No database: the API is answered in the browser.
 */
const PHONE_SIZE = { width: 360, height: 740 };
const WIDE_SIZE = { width: 1440, height: 900 };
const TV_SIZE = { width: 1920, height: 1080 };

const TV = ['h1: Live board', 'h2: Nobody has s', 'h2: Being repair', 'h2: Paused and w'];
/** The three stopped machines, oldest first, with their ages masked (they grow with the clock). */
const TILES = ['CNC-01 T Cell 6', 'DRL-04 T Cell 2', 'GRD-07 T Spare part · Cell 3'];

const mask = (text: string) =>
  text.replace(/\d+ h \d+ min|\d+ h|\d+ min/g, 'T').replace(/\s+/g, ' ');

async function tiles(page: Page): Promise<string[]> {
  const rows = await page.locator('[data-testid=tile]').allInnerTexts();
  return rows.map(mask);
}

async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('heading').first()).toBeVisible();
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`board and settings control order, ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test('phone: the board and every settings screen keep their order', async ({ page }) => {
      await page.setViewportSize(PHONE_SIZE);
      await mockPlant(page);
      for (const [path, expected] of PHONE) {
        await open(page, path);
        await expect.poll(() => controlOrder(page), { message: path }).toEqual(expected);
      }
    });

    test('desktop: the board and every settings screen keep their order', async ({ page }) => {
      await page.setViewportSize(WIDE_SIZE);
      await mockPlant(page);
      for (const [path, expected] of WIDE) {
        await open(page, path);
        await expect.poll(() => controlOrder(page), { message: path }).toEqual(expected);
      }
    });

    test('the board prints the same stops and counts on the phone and the TV', async ({ page }) => {
      await mockPlant(page);
      await page.setViewportSize(PHONE_SIZE);
      await open(page, '/desk/board');
      await expect.poll(() => tiles(page)).toEqual(TILES);
      await expect(page.getByTestId('count-running')).toHaveText('1');
      await expect(page.getByTestId('count-stopped')).toHaveText('3');
      await expect(page.getByTestId('age-oneToFour')).toHaveText('3');
      await page.setViewportSize(TV_SIZE);
      await open(page, '/desk/board?kiosk=1');
      await expect.poll(() => controlOrder(page)).toEqual(TV);
      await expect.poll(() => tiles(page)).toEqual(TILES);
      await expect(page.getByTestId('age-overDay')).toHaveText('0');
      await expect(page.getByTestId('count-running')).toHaveText('1');
      await expect(page.getByTestId('count-stopped')).toHaveText('3');
    });
  });
}
