import { expect, test, type Page, type Route } from '@playwright/test';
import { mockPlant } from './plant-mock.js';

/**
 * The Dashboard live at /analytics/today in the real app (router, shell, live reader, rows panel), its API answered in
 * the browser with invented figures. What the unit tests on the model cannot see: where a press lands, what the wheel
 * does to the page, and what a hover does to its width. The real-server run is `e2e/analytics.spec.ts`.
 */
const ids = (count: number) =>
  Array.from(
    { length: count },
    (_, at) => `00000000-0000-4000-8000-${String(at + 1).padStart(12, '0')}`,
  );
const figure = (key: string, value: unknown, drill: { type: string; ids: string[] }) => ({
  key,
  screen: 'dashboard',
  owner: 1,
  status: 'ready',
  value,
  drill,
});
/**
 * Twelve machines spread over the whole plot, from the origin to the far edge, alternately of a type with a very long
 * name and a short one: a tooltip is widest where the long type sits, wherever it sits.
 */
const LONG_TYPE = 'Vertical Double Column Machining Center';
const POINTS = Array.from({ length: 12 }, (_, at) => ({
  x: [3, 12, 25, 40, 60, 85, 110, 150, 190, 230, 270, 310][at]!,
  y: [1, 6, 3, 14, 9, 22, 12, 30, 18, 8, 24, 20][at]!,
  r: 6 + (at % 4) * 4,
  id: ids(12)[at]!,
  model: at % 2 === 0 ? 'Model with a rather long name 900 H' : 'M2',
  age: `${3 + at} yrs`,
  mttr: 2.5 + at,
}));
const MACHINES = POINTS.map((p, at) => ({
  id: p.id,
  code: `DCMC-${String(at + 1).padStart(2, '0')}`,
  category: at % 2 === 0 ? LONG_TYPE : 'CNC Angular Grinding',
  cell: `${(at % 3) + 1}`,
  segment_id: null,
  group_id: null,
  criticality: 'B',
}));

async function stub(page: Page): Promise<void> {
  await mockPlant(page);
  await page.route('**/api/v1/analytics/action-center', (route: Route) =>
    route.fulfill({
      json: {
        asOf: '2026-11-11',
        snoozeDays: 7,
        types: {},
        nudges: [],
        counts: { open: 0, ack: 0, snoozed: 0, resolved: 0 },
        bySeverity: { high: 0, med: 0, low: 0, info: 0 },
        risk: [],
      },
    }),
  );
  await page.route('**/api/v1/config', (route: Route) =>
    route.fulfill({
      json: {
        features: {},
        language: 'en',
        timeZone: 'Asia/Kolkata',
        lists: {},
        segments: [],
        groups: [],
        machines: MACHINES,
        people: [],
        shifts: [],
        severityMatrix: {},
        i18nOverrides: {},
        slaPolicies: [],
        fp: 'fp',
      },
    }),
  );
  await page.route('**/api/v1/state', (route: Route) =>
    route.fulfill({ json: { open: [], needReport: [], now: '2026-11-11T09:00:00.000Z' } }),
  );
  await page.route('**/api/v1/analytics/figures**', (route: Route) =>
    route.fulfill({
      json: {
        asOf: '2026-11-11',
        profile: {},
        excludedMachines: 0,
        rows: { machines: 3, moves: 0, tickets: 0, tasks: 0, reports: 0, people: 0 },
        figures: [
          figure('dashboard.total-machines', 7, { type: 'machine', ids: ids(7) }),
          figure('dashboard.cnc-machines', 3, { type: 'machine', ids: ids(3) }),
          figure(
            'dashboard.bubble-chart',
            {
              axes: { x: 'BD hours', y: 'Breakdowns' },
              datasets: [{ label: 'Machines', data: POINTS }],
            },
            { type: 'machine', ids: ids(POINTS.length) },
          ),
        ],
      },
    }),
  );
}

async function open(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await stub(page);
  await page.goto('/analytics/today');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Dashboard', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.v2-bubble-dot')).toHaveCount(POINTS.length);
}

/**
 * Presses a point 14 px in from a card's bottom-left corner: inside the card, clear of its rounded corner and of its
 * value button. It waits for the fonts, so a late font swap cannot move the card under the pointer, and presses through
 * the card's own locator, which waits for the card to hold still and checks that the card (or something in it) is what
 * the pointer lands on: a rail or a banner in the way fails the press with its name instead of a silent miss.
 */
const corner = async (page: Page, name: string) => {
  await page.evaluate(() => document.fonts.ready);
  const card = page.getByRole('region', { name, exact: true });
  await expect(card).toBeVisible();
  const box = (await card.boundingBox())!;
  const point = { x: 14, y: Math.max(14, box.height - 14) };
  const button = await card.locator('.v2-drill-value').boundingBox();
  if (button) {
    const [x, y] = [box.x + point.x, box.y + point.y];
    const onButton =
      x >= button.x &&
      x <= button.x + button.width &&
      y >= button.y &&
      y <= button.y + button.height;
    expect(onButton, 'the press must not be on the value button itself').toBe(false);
  }
  await card.click({ position: point });
};

test('a card is one target: a press on its corner opens the rows behind its figure', async ({
  page,
}) => {
  await open(page, 1440);
  await corner(page, 'Total machines');
  await expect(page).toHaveURL(/[?&]drawer=figure:dashboard\.total-machines/);
  await expect(page.locator('aside.v2-drawer')).not.toHaveAttribute('inert', '');
});

test('a machine-type card is one target too: a press on its corner opens its register', async ({
  page,
}) => {
  await open(page, 1440);
  await corner(page, 'CNC machines');
  await expect(page).toHaveURL(/screen=registers&register=machines/);
});

test('Ctrl and the wheel zoom the plot and are kept from zooming the page', async ({ page }) => {
  await open(page, 1440);
  const prevented = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const plot = document.querySelector('.v2-bubble-plot')!;
        document.addEventListener('wheel', (e) => resolve(e.defaultPrevented), { once: true });
        plot.dispatchEvent(
          new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true }),
        );
      }),
  );
  expect(prevented).toBe(true);
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeEnabled();
});

test('the zoom stays when the page reads again, and a filter starts the picture again', async ({
  page,
}) => {
  await page.clock.install();
  await open(page, 1440);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const shown = await page.locator('.v2-bubble-dot').count();
  await page.clock.fastForward(31_000);
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeEnabled();
  expect(await page.locator('.v2-bubble-dot').count()).toBe(shown);
  await page.getByLabel('Age', { exact: true }).selectOption({ index: 1 });
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeDisabled();
});

test('hovering any bubble on a phone, long type names included, never makes the page wider', async ({
  page,
}) => {
  await open(page, 360);
  const dots = page.locator('.v2-bubble-dot');
  await dots.first().scrollIntoViewIfNeeded();
  for (let at = 0; at < POINTS.length; at += 1) {
    await dots.nth(at).hover();
    const tip = page.locator('.v2-bubble-tip');
    await expect(tip).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `bubble ${at}`).toBe(
      360,
    );
    const box = (await tip.boundingBox())!;
    expect(box.x, `bubble ${at} tooltip left edge`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `bubble ${at} tooltip right edge`).toBeLessThanOrEqual(360);
  }
  // The long type is really in the tooltips this ran over.
  await dots.first().hover();
  await expect(page.locator('.v2-bubble-tip')).toContainText(LONG_TYPE);
});
