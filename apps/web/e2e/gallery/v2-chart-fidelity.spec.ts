import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
test.use({ trace: 'retain-on-failure' });

/** The fourteen machine categories of the 11 November plant, the longest first in the engine's own words. */
const CATEGORIES = [
  'Turning Center',
  'Vertical Machining Center',
  'Vertical Double Column Machining Center',
  'Cnc Sliding Head Automatic Lathe',
  'Horizontal Machining Center',
  'CAM Profile Machine',
  'Vertical Turning Lathe',
  'Turnmill',
  'Cylinderical rotary Grinding',
  'CNC Surface Grinding',
  'CNC Angular Grinding',
  'CNC Internal Grinding',
  'Centerless Grinding Machine',
  'WaterJet CNC',
];

async function open(page: Page, view: string, width: number, theme = 'light') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=${view}&theme=${theme}`);
  await expect(page.locator('[data-chart-state="ready"]').first()).toBeVisible();
  for (const chart of await page.locator('[data-chart-state]').all())
    await expect(chart).toHaveAttribute('data-chart-state', 'ready');
}

const chart = (page: Page, title: string): Locator =>
  page.getByRole('region', { name: title, exact: true }).locator('svg').first();

/** What a chart prints, one string per label, spaces squeezed (the engine writes a double space in one name). */
async function printed(svg: Locator): Promise<string[]> {
  const texts = await svg.locator('text').allTextContents();
  return texts.map((text) => text.replace(/\s+/g, ' ').trim());
}

/** Whether two printed things overlap on the page. */
async function overlap(a: Locator, b: Locator): Promise<boolean> {
  const [x, y] = await Promise.all([a.boundingBox(), b.boundingBox()]);
  if (!x || !y) return false;
  return x.x < y.x + y.width && y.x < x.x + x.width && x.y < y.y + y.height && y.y < x.y + x.height;
}

for (const width of [1440, 360]) {
  test(`Category and cell at ${width} px: every one of the 14 category names is on the chart, and the page does not scroll sideways`, async ({
    page,
  }) => {
    await open(page, 'v2-category-cell', width);
    for (const title of [
      'BD hours by category',
      'Breakdowns by category',
      'Average BD hours per machine by category',
      'Average breakdowns per machine by category',
    ]) {
      // A narrow card wraps a long name onto lines, one text each, in reading order: read them joined.
      const text = (await printed(chart(page, title))).join(' ');
      for (const category of CATEGORIES)
        expect(text, `${title}: ${category}`).toContain(category.replace(/\s+/g, ' '));
    }
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(wide).toBe(false);
  });
}

test('Category and cell: a by-category chart ranks worst first and marks the top three, with the number on every bar', async ({
  page,
}) => {
  await open(page, 'v2-category-cell', 1440);
  const names = await printed(chart(page, 'BD hours by category'));
  expect(names.indexOf('Vertical Machining Center')).toBeLessThan(names.indexOf('Turning Center'));
  expect(names.indexOf('Turning Center')).toBeLessThan(names.indexOf('Turnmill'));
  for (const value of ['1057.79', '944.19', '439.82']) expect(names).toContain(value);
});

test('BD % and PM split: breakdown is drawn red, planned maintenance blue and striped, and both are named in the legend', async ({
  page,
}) => {
  await open(page, 'v2-bd-pm', 1440);
  const cells = chart(page, 'BD % and PM % by cell');
  const names = await printed(cells);
  expect(names).toEqual(expect.arrayContaining(['BD %', 'PM %']));
  const paint = await cells.evaluate((svg) => {
    const token = (name: string) => {
      const probe = document.createElement('span');
      probe.style.color = getComputedStyle(document.documentElement).getPropertyValue(name);
      document.body.append(probe);
      const rgb = getComputedStyle(probe).color;
      probe.remove();
      return rgb;
    };
    const rgb = (value: string) => {
      const probe = document.createElement('span');
      probe.style.color = value;
      document.body.append(probe);
      const out = getComputedStyle(probe).color;
      probe.remove();
      return out;
    };
    const fills = [...svg.querySelectorAll('path[fill]')].map((p) => p.getAttribute('fill') ?? '');
    return {
      loss: token('--color-v2-loss-fill'),
      plan: token('--color-v2-plan-fill'),
      solid: fills.filter((f) => !f.startsWith('url(')).map(rgb),
      striped: fills.some((f) => f.startsWith('url(')),
    };
  });
  expect(paint.solid).toContain(paint.loss);
  expect(paint.striped).toBe(true);
  expect(paint.loss).not.toBe(paint.plan);
  // A percent chart says so on its axis numbers.
  expect(names).toContain('1.5%');
});

test('BD % and PM split: no axis title or last-point name is printed over another', async ({
  page,
}) => {
  await open(page, 'v2-bd-pm', 1440);
  const months = chart(page, 'BD and PM hours by month');
  // The legend names the two lines once; no end label sits over the last (December) point.
  expect((await printed(months)).filter((t) => t === 'BD Hrs')).toHaveLength(1);
  await open(page, 'v2-category-cell', 1440);
  const cells = chart(page, 'BD hours by cell');
  const title = cells.locator('text', { hasText: /^BD Hrs$/ });
  await expect(title).toHaveCount(1);
  const ticks = cells.locator('text', { hasText: /^\d[\d,]*$/ });
  for (const tick of await ticks.all()) expect(await overlap(title, tick)).toBe(false);
});

for (const theme of ['light', 'dark']) {
  for (const [view, width] of [
    ['v2-category-cell', 1440],
    ['v2-category-cell', 360],
    ['v2-bd-pm', 360],
  ] as const) {
    test(`Chart kit: axe finds nothing on ${view} at ${width} px in ${theme}`, async ({ page }) => {
      await open(page, view, width, theme);
      const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual(
        [],
      );
    });
  }
}

for (const theme of ['light', 'dark']) {
  test(`Chart kit: no chart box scrolls sideways, as a drawer narrows its card (${theme}, ADR 0065)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('about:blank');
    await page.goto(`/gallery?view=v2-footprint&theme=${theme}`);
    const box = page.locator('.v2-trend-box').first();
    const scrolls = () => box.evaluate((el) => el.scrollWidth > el.clientWidth);
    await expect(page.locator('[data-chart-state="ready"]').first()).toBeVisible();
    await expect.poll(scrolls).toBe(false);
    await page
      .getByRole('button', { name: /^[A-Z]{1,4}-\d+$/ })
      .first()
      .click();
    await expect(page.locator('aside.v2-drawer')).not.toHaveAttribute('inert', '');
    await expect.poll(scrolls).toBe(false);
  });
}
