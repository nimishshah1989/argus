import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import snapshot from '../../src/gallery/directions/generated/figures.json' with { type: 'json' };

const figure = (key: string) => snapshot.figures.find((f) => f.key === key)!.value as never;
const shown = (n: number, digits: number) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);

const plant = (figure('showcase') as { plant: { mtbfYear: number; mttrYear: number } }).plant;

/** Each tile's value and unit exactly as the engine's snapshot gives them. */
const TILES = [
  ['availability', shown(figure('dashboard.fleet-availability'), 2), '%'],
  ['downtime', shown(figure('dashboard.total-downtime-hours'), 1), 'h'],
  ['breakdowns', shown(figure('dashboard.total-breakdowns'), 0), ''],
  ['mtbf', shown(plant.mtbfYear, 1), 'h'],
  ['mttr', shown(plant.mttrYear, 2), 'h'],
  ['pm', shown(figure('dashboard.pm-hours'), 1), 'h'],
] as const;

async function open(page: Page): Promise<void> {
  await page.goto('/gallery?view=showcase');
  await expect(page.getByTestId('trend-chart').locator('svg')).toBeVisible();
}

/** June is the sixth of eleven months: sweep the plot until its tooltip is up and return its text. */
async function tooltipOfJune(page: Page): Promise<string> {
  await page.getByTestId('trend-chart').scrollIntoViewIfNeeded();
  const box = (await page.getByTestId('trend-chart').boundingBox())!;
  const tip = page.locator('.sc-tip');
  for (let x = 0.1; x < 0.95; x += 0.02) {
    await page.mouse.move(box.x + box.width * x, box.y + box.height * 0.4);
    if ((await tip.count()) > 0 && (await tip.first().innerText()).includes('June')) break;
  }
  return tip.first().innerText();
}

for (const width of [360, 1440]) {
  test.describe(`the analytics showcase at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the tiles show the snapshot values with their units', async ({ page }) => {
      await open(page);
      for (const [id, value, unit] of TILES) {
        const tile = page.getByTestId(`kpi-${id}`);
        await expect(page.getByTestId(`kpi-${id}-value`)).toHaveText(value);
        if (unit) await expect(tile).toContainText(unit);
        await expect(tile).toContainText('Year to date');
        await expect(tile).toContainText(/than in/);
      }
    });

    test('pointing at a month shows the designed tooltip with its extra facts', async ({
      page,
    }) => {
      await open(page);
      const text = await tooltipOfJune(page);
      expect(text).toContain('June 2026');
      expect(text).toContain('98.49');
      for (const fact of ['Usual range', 'Breakdowns', 'Top cause', 'Worst machine', 'Longest']) {
        expect(text).toContain(fact);
      }
      expect(text).toContain('TMC-2');
    });

    test('pointing at a Pareto bar lights its machines in the heat map', async ({ page }) => {
      await open(page);
      const chart = page.getByTestId('pareto-chart');
      await chart.scrollIntoViewIfNeeded();
      const box = (await chart.boundingBox())!;
      for (let y = 0.08; y < 0.4; y += 0.04) {
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * y);
        if ((await page.locator('.sc-heat tr[data-link]').count()) > 0) break;
      }
      await expect(page.locator('.sc-heat tr[data-link]').first()).toBeAttached();
      await expect(page.locator('.sc-tip').last()).toContainText('Mostly on');
    });

    test('a tile opens the side sheet with the figure explained', async ({ page }) => {
      await open(page);
      await page.getByTestId('kpi-mtbf').click();
      const sheet = page.getByTestId('kpi-sheet');
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText('How it is worked out');
      await expect(sheet).toContainText('The months behind it');
      await expect(sheet.getByRole('row')).toHaveCount(12);
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
    });

    test('no sideways scroll and no axe violation', async ({ page }) => {
      await open(page);
      const wide = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(wide).toBe(false);
      await page.getByTestId('kpi-pm').click();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });

    test('with reduced motion the numbers are at their final values at once', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/gallery?view=showcase');
      // No count-up: the first paint of the tile already holds the final figure, charts or not.
      const value = page.getByTestId('kpi-breakdowns-value');
      await expect(value).toBeVisible();
      await expect(value).toHaveText(shown(figure('dashboard.total-breakdowns'), 0), {
        timeout: 100,
      });
    });
  });
}
