import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { mockPlant } from './plant-mock.js';
import { openShowDetail } from '../show-detail.js';

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
  // Figures past the fourth fold sit under "Show detail" (ADR 0041).
  await openShowDetail(page);
}

/** What a press at a page point would land on: the element, its ancestors up to the card, and the styles that decide it. */
type Landing = {
  chain: string[];
  insideCard: boolean;
  onValueButton: boolean;
  pointerEvents: string;
  cardTransform: string;
  cardTransition: string;
  railOpen: boolean;
  fonts: string;
};

/**
 * Presses a point 14 px in from a card's bottom-RIGHT corner: inside the card, clear of its rounded corner, of its value
 * button (top left) and of the rail that opens over the page's left edge. It never waits on a locator's actionability
 * and every wait is short, so a press that cannot work fails in seconds and says why: before pressing it reads what
 * the pointer would land on (the element and its ancestors, the styles that decide it, the fonts' state), prints it
 * and attaches it to the test, and fails if that is not the card or something in it.
 */
const corner = async (page: Page, name: string, testInfo: TestInfo) => {
  const card = page.getByRole('region', { name, exact: true });
  await expect(card).toBeVisible({ timeout: 5_000 });
  await card.scrollIntoViewIfNeeded({ timeout: 5_000 });
  await page.mouse.move(700, 4); // away from the rail, which opens over the page's left edge when hovered
  const box = (await card.boundingBox())!;
  const [x, y] = [box.x + box.width - 14, box.y + box.height - 14];
  const landing = await page.evaluate(
    // eslint-disable-next-line complexity -- runs inside the page as one self-contained function
    ([px, py, label]): Landing => {
      const el = document.elementFromPoint(px!, py!);
      const cardEl = document.querySelector(`section[aria-label="${label}"]`);
      const chain: string[] = [];
      for (let at: Element | null = el; at && chain.length < 6; at = at.parentElement)
        chain.push(
          `${at.tagName.toLowerCase()}.${String(at.className).trim().replace(/\s+/g, '.')}`,
        );
      const style = cardEl ? getComputedStyle(cardEl) : null;
      const button = cardEl?.querySelector('.v2-drill-value')?.getBoundingClientRect();
      return {
        chain,
        insideCard: !!el && !!cardEl && cardEl.contains(el),
        onValueButton:
          !!button &&
          px! >= button.left &&
          px! <= button.right &&
          py! >= button.top &&
          py! <= button.bottom,
        pointerEvents: el ? getComputedStyle(el).pointerEvents : 'none',
        cardTransform: style?.transform ?? '',
        cardTransition: style?.transition ?? '',
        railOpen: !!document.querySelector('.v2-rail:hover, .v2-rail:focus-within'),
        fonts: document.fonts.status,
      };
    },
    [x, y, name] as const,
  );
  const report = JSON.stringify({ name, point: { x, y }, box, ...landing }, null, 1);
  console.log(`press ${name}: ${report}`);
  await testInfo.attach(`press-${name}`, { body: report, contentType: 'application/json' });
  expect(landing.insideCard, `the press at (${x}, ${y}) lands outside the card: ${report}`).toBe(
    true,
  );
  expect(landing.onValueButton, 'the press must not be on the value button itself').toBe(false);
  await page.mouse.click(x, y);
};

test('a card is one target: a press on its corner opens the rows behind its figure', async ({
  page,
}, testInfo) => {
  test.setTimeout(30_000);
  await open(page, 1440);
  await corner(page, 'Total machines', testInfo);
  await expect(page).toHaveURL(/[?&]drawer=figure:dashboard\.total-machines/, { timeout: 5_000 });
  await expect(page.locator('aside.v2-drawer')).not.toHaveAttribute('inert', '', {
    timeout: 5_000,
  });
});

test('a machine-type card is one target too: a press on its corner opens its register', async ({
  page,
}, testInfo) => {
  test.setTimeout(30_000);
  await open(page, 1440);
  await corner(page, 'CNC machines', testInfo);
  await expect(page).toHaveURL(/screen=registers&register=machines/, { timeout: 5_000 });
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
