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
/** Bubbles the plant does not list, so each is a dash: the right-most sits at the far edge of the plot. */
const POINTS = [
  { x: 5, y: 2, r: 6, id: ids(10)[0], model: 'M1', age: '3 yrs', mttr: 2.5 },
  { x: 40, y: 9, r: 12, id: ids(10)[1], model: 'M2', age: '12 yrs', mttr: 4.4 },
  {
    x: 310,
    y: 20,
    r: 20,
    id: ids(10)[2],
    model: 'M3 with a long model name',
    age: '22 yrs',
    mttr: 15.4,
  },
];

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
            { type: 'machine', ids: ids(3) },
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
  await expect(page.locator('.v2-bubble-dot')).toHaveCount(3);
}

const corner = async (page: Page, name: string) => {
  const box = await page.getByRole('region', { name, exact: true }).boundingBox();
  expect(box).not.toBeNull();
  // 12 px in from the bottom-left corner: inside the card, nowhere near its value button.
  await page.mouse.click(box!.x + 12, box!.y + box!.height - 12);
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

test('hovering the right-most bubble on a phone never makes the page wider', async ({ page }) => {
  await open(page, 360);
  const dot = page.locator('.v2-bubble-dot').last();
  await dot.scrollIntoViewIfNeeded();
  await dot.hover();
  await expect(page.locator('.v2-bubble-tip')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const tip = (await page.locator('.v2-bubble-tip').boundingBox())!;
  expect(tip.x).toBeGreaterThanOrEqual(0);
  expect(tip.x + tip.width).toBeLessThanOrEqual(360);
});
