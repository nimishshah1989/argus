import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const KINDS = ['overview', 'analysis', 'register', 'entity', 'queue'] as const;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.use({ reducedMotion: 'reduce' });

const demo = (page: Page, kind: string) => page.getByTestId(`demo-${kind}`);
const part = (page: Page, kind: string, cls: string) => demo(page, kind).locator(`.${cls}`);
const box = async (l: Locator) => (await l.boundingBox())!;

async function open(page: Page, theme = 'light') {
  await page.goto(`/gallery?view=templates&theme=${theme}`);
  await expect(page.getByTestId('template')).toHaveCount(KINDS.length + 4);
  for (const chart of await page.getByTestId('chart').all())
    await expect(chart).toHaveAttribute('data-chart-state', 'ready');
}

test.describe('phone, 360 px', () => {
  test('every template is one column with no sideways scroll', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
    for (const kind of KINDS) {
      const regions = await demo(page, kind).locator('.at-grid > *').all();
      const boxes = await Promise.all(regions.map(box));
      for (const [i, b] of boxes.entries()) {
        expect(b.x, `${kind} region ${i} starts at the gutter`).toBe(boxes[0]!.x);
        if (i > 0) expect(b.y).toBeGreaterThanOrEqual(boxes[i - 1]!.y + boxes[i - 1]!.height - 1);
      }
    }
  });

  test('the figures run two to a row', async ({ page }) => {
    await open(page);
    const tiles = part(page, 'overview', 'at-figures').locator('> *');
    expect(await tiles.count()).toBe(6);
    const ys = new Set(await Promise.all((await tiles.all()).map(async (t) => (await box(t)).y)));
    expect(ys.size).toBe(3);
  });

  test('the drill area sits under the content, in full width', async ({ page }) => {
    await open(page);
    for (const kind of ['overview', 'analysis', 'register', 'queue']) {
      const main = await box(part(page, kind, 'at-main'));
      const drill = await box(part(page, kind, 'at-drill'));
      expect(drill.y).toBeGreaterThanOrEqual(main.y + main.height);
      expect(drill.width).toBeCloseTo(main.width, 0);
    }
  });

  test('the header controls and the filters are 44 px or taller', async ({ page }) => {
    await open(page);
    for (const kind of KINDS)
      for (const control of await demo(page, kind)
        .locator('.at-actions button, .at-filters button')
        .all())
        expect((await box(control)).height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('laptop, 1440 px', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the figures run four to six to a row', async ({ page }) => {
    await open(page);
    const tiles = await part(page, 'overview', 'at-figures').locator('> *').all();
    const ys = await Promise.all(tiles.map(async (t) => (await box(t)).y));
    const firstRow = ys.filter((y) => y === ys[0]).length;
    expect(firstRow).toBeGreaterThanOrEqual(4);
    expect(firstRow).toBeLessThanOrEqual(6);
  });

  test('an analysis and an entity put their aside beside the content, the drill below', async ({
    page,
  }) => {
    await open(page);
    for (const kind of ['analysis', 'entity']) {
      const main = await box(part(page, kind, 'at-main'));
      const aside = await box(part(page, kind, 'at-aside'));
      expect(aside.x).toBeGreaterThanOrEqual(main.x + main.width);
      expect(aside.y).toBeLessThanOrEqual(main.y + 1);
    }
    const main = await box(part(page, 'analysis', 'at-main'));
    const drill = await box(part(page, 'analysis', 'at-drill'));
    expect(drill.y).toBeGreaterThanOrEqual(main.y + main.height);
  });

  test('a register and a work queue open their drill beside the list', async ({ page }) => {
    await open(page);
    for (const kind of ['register', 'queue']) {
      const main = await box(part(page, kind, 'at-main'));
      const drill = await box(part(page, kind, 'at-drill'));
      expect(drill.x).toBeGreaterThanOrEqual(main.x + main.width);
      expect(Math.abs(drill.y - main.y)).toBeLessThan(2);
    }
  });

  test('the overview lays its charts two across', async ({ page }) => {
    await open(page);
    const [a, b] = await part(page, 'overview', 'at-main').locator('> *').all();
    expect(Math.abs((await box(a!)).y - (await box(b!)).y)).toBeLessThan(2);
  });
});

for (const theme of ['light', 'dark']) {
  test(`${theme}: the templates are axe clean`, async ({ page }) => {
    await open(page, theme);
    if (theme === 'dark') await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(axe.violations).toEqual([]);
  });
}

test('a template with no data keeps its filters and says why', async ({ page }) => {
  await open(page);
  const loading = demo(page, 'state-loading');
  await expect(loading.getByRole('status')).toBeVisible();
  await expect(loading.locator('.at-filters button')).toHaveCount(2);
  await expect(loading.locator('.at-figures, .at-main')).toHaveCount(0);
  await expect(demo(page, 'state-error').getByRole('alert')).toBeVisible();
  await expect(demo(page, 'state-error').getByRole('button', { name: /try again/i })).toBeVisible();
  await expect(demo(page, 'state-offline').getByRole('status')).toContainText(/offline/i);
  await expect(demo(page, 'state-empty')).toContainText('Nothing to show for this period.');
});
