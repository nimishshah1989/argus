import { expect, test } from '@playwright/test';

const TITLES = [
  'Bars',
  'Stacked bars',
  'Horizontal bars',
  'Lines',
  'Scatter',
  'Heat map',
  'Pareto',
];

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await page.goto('/gallery?view=charts');
  await expect(page.getByTestId('chart')).toHaveCount(TITLES.length);
  for (const chart of await page.getByTestId('chart').all())
    await expect(chart).toHaveAttribute('data-chart-state', 'ready');
});

test('every kind draws an SVG and keeps "Show the numbers" with its table', async ({ page }) => {
  for (const title of TITLES) {
    const figure = page.locator('figure', { hasText: title }).first();
    await expect(figure.locator('svg').first()).toBeVisible();
    await figure.locator('summary').click();
    const table = figure.locator('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('rowheader', { name: 'Wear' })).toBeVisible();
  }
});

test('stacked bars and the Pareto name each series in a legend', async ({ page }) => {
  const stacked = page.locator('figure', { hasText: 'Stacked bars' }).locator('svg').first();
  await expect(stacked.locator('text', { hasText: 'Hours' })).not.toHaveCount(0);
  await expect(stacked.locator('text', { hasText: 'Jobs' })).not.toHaveCount(0);
  const pareto = page.locator('figure', { hasText: 'Pareto' }).locator('svg').first();
  await expect(pareto.locator('text', { hasText: 'Cumulative %' })).not.toHaveCount(0);
});

test('under reduced motion no chart animates', async ({ page }) => {
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true,
  );
  const running = await page.evaluate(
    () => document.querySelectorAll('animate, animateTransform, animateMotion, set').length,
  );
  expect(running).toBe(0);
  const animations = await page.evaluate(() => document.getAnimations().length);
  expect(animations).toBe(0);
});
