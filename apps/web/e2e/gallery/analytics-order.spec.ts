import { expect, test } from '@playwright/test';
import { controlOrder } from './desk-mock.js';
import { SCREENS, SHELL_PHONE, SHELL_WIDE } from './analytics-order-data.js';
import { PRINTED } from './analytics-printed-data.js';
import { mockAnalytics } from './analytics-mock.js';

/**
 * LOCK.md rule 1 and ticket 87: the new look never moves a control on an analytics screen and never changes a figure.
 * The lists in `analytics-order-data.ts` were read off these screens BEFORE the restyle (the invented plant of
 * `analytics-mock.ts`; `controlOrder` cuts each name at 12 letters) and are written out in full: a restyle that
 * reorders, adds or drops a control, a tab or a heading fails here. The texts under "prints" are the engine's own, a
 * blank, a dash and a "pts" among them. No database: the API is answered in the browser.
 */
const SIZES = {
  phone: { width: 360, height: 740 },
  wide: { width: 1440, height: 900 },
} as const;

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
            .poll(() => controlOrder(page), { message: path })
            .toEqual([...shell, ...menu, ...body]);
        }
      });
    }

    test('every screen prints the engine figures as written', async ({ page }) => {
      await page.setViewportSize(SIZES.wide);
      await mockAnalytics(page);
      for (const [path, texts] of PRINTED) {
        await page.goto(path);
        await expect(page.getByRole('heading').first()).toBeVisible();
        for (const text of texts)
          await expect(
            page.getByText(text, { exact: true }).first(),
            `${path}: ${text}`,
          ).toBeVisible();
      }
    });
  });
}
