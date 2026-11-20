import { expect, test, type Page } from '@playwright/test';
import { SCREENS, SHELL_PHONE, SHELL_WIDE } from './analytics-order-data.js';
import { analyticsOrder, mockAnalytics } from './analytics-mock.js';
import { PRINTED } from './analytics-printed-data.js';

/**
 * LOCK.md rule 1 and ticket 87: the new look never moves a control on an analytics screen and never changes a figure.
 * The lists in `analytics-order-data.ts` are written out in full (the invented plant of `analytics-mock.ts`;
 * `analyticsOrder` cuts each name at 12 letters and also reads a chart's "Show the numbers"): a restyle that reorders,
 * adds or drops a control, a tab, a heading or a chart summary fails here. The figures under "prints" are checked
 * where they belong, in their own tile or table row, a blank cell and a dash among them. No database: the API is
 * answered in the browser.
 */
const SIZES = {
  phone: { width: 360, height: 740 },
  wide: { width: 1440, height: 900 },
} as const;

/** The smallest block holding a tile's label, its value and its sub-line. */
const tileOf = (page: Page, parts: string[]) =>
  parts
    .reduce(
      (found, part) => found.filter({ has: page.getByText(part, { exact: true }) }),
      page.locator('li, section, div'),
    )
    .last();

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`analytics screens keep their order, ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    for (const size of ['phone', 'wide'] as const) {
      test(`${size}: every screen lists the same controls and headings`, async ({ page }) => {
        await page.setViewportSize(SIZES[size]);
        await mockAnalytics(page);
        const shell = size === 'phone' ? SHELL_PHONE : SHELL_WIDE;
        for (const [path, menu, body] of SCREENS) {
          await page.goto(path);
          await expect(page.getByRole('heading').first()).toBeVisible();
          await expect
            .poll(() => analyticsOrder(page), { message: path })
            .toEqual([...shell, ...menu, ...body]);
        }
      });
    }

    test('every screen prints the engine figures as written, each in its own place', async ({
      page,
    }) => {
      await page.setViewportSize(SIZES.wide);
      await mockAnalytics(page);
      for (const { path, tiles, rows } of PRINTED) {
        await page.goto(path);
        await expect(page.getByRole('heading').first()).toBeVisible();
        for (const [label, value, sub] of tiles)
          await expect(
            tileOf(page, [label, value, ...(sub ? [sub] : [])]),
            `${path}: ${label}`,
          ).toBeVisible();
        for (const [name, at, cells] of rows) {
          const row = page
            .getByRole('table', { name, exact: true })
            .getByRole('row')
            .nth(at + 1);
          await expect(row.getByRole('cell'), `${path}: ${name} ${at}`).toHaveText(cells);
        }
      }
    });
  });
}
