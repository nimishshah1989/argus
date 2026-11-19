import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const DIRECTIONS = ['instrument', 'control-room', 'ledger'];
const ACCENT = ['#0f766e', '#0e7490', '#3538cd'];
const stage = (page: Page) => page.getByTestId('directions-stage');

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/gallery?view=directions${query}`);
  await expect(stage(page)).toBeVisible();
}

const inline = (page: Page, name: string) =>
  page.evaluate((n) => document.documentElement.style.getPropertyValue(n), name);

/** What one attribute reads on the first element that carries it, in each direction in turn. */
async function acrossDirections(page: Page, name: string): Promise<(string | null)[]> {
  const seen: (string | null)[] = [];
  for (const v of [1, 2, 3]) {
    await open(page, `&v=${v}`);
    seen.push(await page.locator(`[data-${name}]`).first().getAttribute(`data-${name}`));
  }
  return seen;
}

/** The same tests at a phone's width and at a laptop's. */
function atBothWidths(title: string, define: () => void): void {
  for (const width of [360, 1440]) {
    test.describe(`${title} at ${width} px`, () => {
      test.use({ viewport: { width, height: 900 } });
      define();
    });
  }
}

atBothWidths('the picker', () => {
  test('keys 1, 2 and 3 flip the direction and the address keeps ?v=', async ({ page }) => {
    await open(page);
    await expect(stage(page)).toHaveAttribute('data-direction', 'instrument');
    for (const [i, id] of DIRECTIONS.entries()) {
      await page.keyboard.press(String(i + 1));
      await expect(stage(page)).toHaveAttribute('data-direction', id);
      await expect(page).toHaveURL(new RegExp(`[?&]v=${i + 1}(&|$)`));
      expect(await inline(page, '--color-accent')).toBe(ACCENT[i]);
    }
    await page.reload();
    await expect(stage(page)).toHaveAttribute('data-direction', 'ledger');
  });

  test('the three buttons flip it too, and one is current', async ({ page }) => {
    await open(page);
    const nav = page.getByRole('navigation', { name: 'Design directions' });
    await nav.getByRole('button', { name: 'Control Room' }).click();
    await expect(stage(page)).toHaveAttribute('data-direction', 'control-room');
    await expect(nav.locator('[aria-current="true"]')).toHaveText('Control Room');
    await expect(page).toHaveURL(/[?&]v=2(&|$)/);
  });

  test('each direction, light and dark, has no sideways scroll and no axe violation', async ({
    page,
  }) => {
    for (const theme of ['light', 'dark']) {
      for (const [i, id] of DIRECTIONS.entries()) {
        await open(page, `&v=${i + 1}&theme=${theme}`);
        await expect(stage(page)).toHaveAttribute('data-direction', id);
        await expect(page.getByTestId('chart')).toHaveAttribute('data-chart-state', 'ready');
        const room = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(room, `${id} ${theme} scrolls sideways`).toBeLessThanOrEqual(0);
        const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        expect(violations, `${id} ${theme}`).toEqual([]);
      }
    }
  });

  test('leaving the view removes every inline property it set on the page', async ({ page }) => {
    await open(page, '&v=3&theme=dark');
    expect(await inline(page, '--color-accent')).not.toBe('');
    await page.getByRole('link', { name: 'Back to the gallery' }).click();
    await expect(page.getByTestId('gallery-root')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.style.length)).toBe(0);
  });
});

atBothWidths('the Elements screen', () => {
  test('chart variants: key place, frame and height differ, and series 3 to 8 and both ramps show', async ({
    page,
  }) => {
    expect(await acrossDirections(page, 'legend')).toEqual(['above', 'inline', 'below']);
    expect(await acrossDirections(page, 'chart-frame')).toEqual(['card', 'panel', 'rules']);
    for (const [v, height] of [192, 160, 224].entries()) {
      await open(page, `&v=${v + 1}`);
      const chart = page.getByTestId('chart');
      await expect(chart).toHaveAttribute('data-chart-state', 'ready');
      expect((await chart.boundingBox())?.height).toBe(height);
      await expect(page.locator('[data-series]')).toHaveCount(8);
      for (const ramp of ['seq', 'div'])
        await expect(page.locator(`[data-ramp="${ramp}"] [data-step]`)).toHaveCount(5);
    }
  });

  test('variants differ: tile shape, delta form and the Indian sample', async ({ page }) => {
    expect(await acrossDirections(page, 'tile')).toEqual(['card', 'edge', 'ruled']);
    expect(await acrossDirections(page, 'delta')).toEqual(['chip', 'inline', 'words']);
    for (const v of [1, 2, 3]) {
      await open(page, `&v=${v}`);
      await expect(page.locator('[data-sample]')).toHaveText('10,00,000');
    }
  });
});
