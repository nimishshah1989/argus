import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockFloor, type FloorRole } from './floor-mock.js';

/**
 * Ticket 89a, the floor phone at 360 x 740 in light and dark, answered from the browser (`floor-mock.ts`):
 * the phone's own behaviour (the mobile-native list), 44 px taps and 52 px primary buttons, axe clean, and the
 * floor following the phone's dark setting. Order and words are `floor-order.spec.ts`.
 */
const SCREENS: {
  name: string;
  path: string;
  role?: FloorRole;
  steps?: (page: Page) => Promise<void>;
}[] = [
  { name: 'machine step', path: '/floor' },
  { name: 'situation', path: '/floor?m=CNC-02' },
  {
    name: 'problem',
    path: '/floor?m=CNC-01',
    steps: async (page) => {
      await page.getByRole('button', { name: /^Machine has stopped/ }).click();
    },
  },
  { name: 'other work', path: '/floor/other' },
  { name: 'my complaints', path: '/floor/mine' },
  { name: 'PM jobs', path: '/floor/pm', role: 'technician' },
];

/** Run in the page: taps under 44 px, fields under 16 px (iOS zooms the page into them) and sideways scroll. */
function probe() {
  const small: string[] = [];
  const zoom: string[] = [];
  const named = (el: HTMLElement) =>
    `${el.tagName.toLowerCase()} ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)}`;
  for (const el of document.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea')) {
    const box = el.getBoundingClientRect();
    if (box.height === 0) continue;
    const row = el.closest('label') ?? el;
    if (row.getBoundingClientRect().height < 44 || (box.width < 44 && !el.closest('label')))
      small.push(`${named(el)} ${Math.round(box.width)}x${Math.round(box.height)}`);
    const field = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
    const tick = el instanceof HTMLInputElement && el.type === 'checkbox';
    if (field && !tick && parseFloat(getComputedStyle(el).fontSize) < 16) zoom.push(named(el));
  }
  return { small, zoom, wide: document.documentElement.scrollWidth - innerWidth };
}

const PHONE = { width: 360, height: 740 };

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`floor on a phone, ${scheme}`, () => {
    test.use({ viewport: PHONE, colorScheme: scheme });

    for (const screen of SCREENS) {
      test(`${screen.name}: taps, inputs, no sideways scroll, axe clean`, async ({ page }) => {
        await mockFloor(page, { role: screen.role, recent: true, draft: true });
        await page.goto(screen.path);
        await expect(page.getByRole('heading').first()).toBeVisible();
        await screen.steps?.(page);
        await page.waitForTimeout(400);

        const found = await page.evaluate(probe);
        expect(found.small, 'a tap target under 44 px').toEqual([]);
        expect(found.zoom, 'a field under 16 px zooms the page on iOS').toEqual([]);
        expect(found.wide, 'sideways scroll').toBeLessThanOrEqual(0);

        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 80)}`)).toEqual([]);
      });
    }

    test('the primary button is 52 px high and the page takes the phone setting', async ({
      page,
    }) => {
      await mockFloor(page, {});
      await page.goto('/floor/other');
      await page.getByRole('heading', { name: 'Other work (not a machine)' }).waitFor();
      const send = await page.getByRole('button', { name: 'Send work request' }).boundingBox();
      expect(send?.height).toBe(52);
      const theme = await page.evaluate(() => document.documentElement.dataset.theme ?? 'light');
      expect(theme).toBe(scheme);
      const bar = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bar).toBe(scheme === 'dark' ? 'rgb(17, 18, 20)' : 'rgb(245, 245, 247)');
    });

    test('no tap flash, safe areas on, status bar matches the page', async ({ page }) => {
      await mockFloor(page, {});
      await page.goto('/floor');
      await page.getByRole('heading', { level: 3 }).first().waitFor();
      const flash = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('-webkit-tap-highlight-color'),
      );
      expect(flash).toMatch(/transparent|rgba\(0, 0, 0, 0\)/);
      const viewport = await page.locator('meta[name=viewport]').getAttribute('content');
      expect(viewport).toContain('viewport-fit=cover');
      const bars = await page
        .locator('meta[name=theme-color]')
        .evaluateAll((metas) =>
          metas.map((m) => `${m.getAttribute('media')}=${m.getAttribute('content')}`),
        );
      expect(bars).toEqual([
        '(prefers-color-scheme: light)=#f5f5f7',
        '(prefers-color-scheme: dark)=#111214',
      ]);
      const tapAction = await page
        .getByRole('button', { name: /^Other work/ })
        .evaluate((el) => getComputedStyle(el).touchAction);
      expect(tapAction).toBe('manipulation');
    });
  });
}
