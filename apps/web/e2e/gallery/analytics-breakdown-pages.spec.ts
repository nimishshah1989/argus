import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import { mockPlant } from './plant-mock.js';

/**
 * BD % and PM split, Category and cell and MTTR and MTBF, live at their v1 address in the real app (the router, the
 * shell, the live reader and the rows panel), with the engine's frozen answer for the 11 November plant as the figures
 * reply and an invented ticket list behind the rows. No database: the API is answered in the browser. The real-server
 * run of the same screens is `e2e/analytics-breakdowns.spec.ts`.
 */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const B = '/analytics/breakdowns?screen=';
const SCREEN_A1 = 'a1-bd-pm';
const SCREEN_A2 = 'a2-category-cell';
const SCREEN_A3 = 'a3-mttr-mtbf';
const SCREEN_A9 = 'a9-bottleneck-forecast';

type KeyTable = { title: string; header: string[]; rows: string[][] };
type KeyPage = {
  title: string;
  kpis: { label: string; value: string; sub: string }[];
  tables: KeyTable[];
  charts: { id: string }[];
};
const keyOf = (name: string): { pages: KeyPage[] } =>
  JSON.parse(
    readFileSync(new URL(`../../../../fixtures/answer-key/${name}.json`, import.meta.url), 'utf8'),
  ) as { pages: KeyPage[] };
const A1 = keyOf(SCREEN_A1).pages[0]!;
const A2 = keyOf(SCREEN_A2).pages[0]!;
const A3 = keyOf(SCREEN_A3).pages[0]!;

/** Ids in the server's shape (the drill reply is checked against its schema), ending in the number the ticket's ref shows. */
const ticketIds = (count: number) =>
  Array.from(
    { length: count },
    (_, at) => `00000000-0000-4000-8000-${String(at + 1).padStart(12, '0')}`,
  );
const FIRST_REF = 'BD-0001';
const drawer = (page: Page) => page.locator('aside.v2-drawer');
const tabs = (page: Page) => page.getByRole('group', { name: 'Breakdowns screens', exact: true });
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

/** The figures reply: the three frozen pages, each counting these tickets; the drill answers a row for every id it is asked. */
async function stub(page: Page, ids: string[] = ticketIds(2)): Promise<string[][]> {
  const asked: string[][] = [];
  const figure = (key: string, value: unknown) => ({
    key,
    screen: key,
    owner: 40,
    status: 'ready',
    value,
    drill: { type: 'ticket', ids },
  });
  await mockPlant(page);
  await page.route('**/api/v1/analytics/figures**', (route: Route) =>
    route.fulfill({
      json: {
        asOf: '2026-11-11',
        profile: {},
        excludedMachines: 0,
        rows: { machines: 125, moves: 0, tickets: ids.length, tasks: 0, reports: 0, people: 0 },
        figures: [
          figure(SCREEN_A1, keyOf(SCREEN_A1)),
          figure(SCREEN_A2, keyOf(SCREEN_A2)),
          figure(SCREEN_A3, keyOf(SCREEN_A3)),
          { ...figure(SCREEN_A9, keyOf(SCREEN_A9)), drill: { type: 'machine', ids: [] } },
        ],
      },
    }),
  );
  await page.route('**/api/v1/analytics/drill**', (route: Route) => {
    const wanted = (new URL(route.request().url()).searchParams.get('ids') ?? '').split(',');
    asked.push(wanted);
    return route.fulfill({
      json: {
        type: 'ticket',
        rows: wanted.map((id) => ({
          id,
          ref: `BD-${id.slice(-4)}`,
          kind: 'stopped',
          status: 'closed',
          machineId: null,
          reportedAt: '2026-11-07T08:00:00.000Z',
          closedAt: '2026-11-07T09:30:00.000Z',
          source: 'history',
          downtimeMin: 90,
          repairMin: 60,
          workType: null,
        })),
      },
    });
  });
  return asked;
}

async function open(page: Page, screen: string, theme: 'light' | 'dark' = 'light') {
  await page.emulateMedia({ colorScheme: theme });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${B}${screen}`);
  await page.mouse.move(900, 700);
}

const noSidewaysScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test('BD % and PM split: its tab is pressed, the six figures, five tables and two charts are up, and the numbers are behind the charts', async ({
  page,
}) => {
  await stub(page);
  await open(page, SCREEN_A1);
  await expect(
    tabs(page).getByRole('button', { name: 'A1 breakdown percent and PM split', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const first = A1;
  await expect(page.getByRole('heading', { level: 1, name: 'BD % and PM split' })).toBeVisible();
  // Figures past the fourth fold under "Show detail" (sweep #706); a no-op before the fold lands.
  for (const s of await page.locator('details.v2-show-detail:not([open]) > summary').all())
    await s.click();
  for (const kpi of first.kpis) {
    const tile = region(page, kpi.label).first();
    await expect(tile).toBeVisible();
    await expect(tile.getByText(kpi.value, { exact: true })).toBeVisible();
    await expect(tile.getByText(kpi.sub, { exact: true })).toBeVisible();
  }
  for (const title of [
    'By Cell — Detail',
    'Month-on-Month — BD % and PM % (2026) · BD %',
    'Month-on-Month — BD % and PM % (2026) · PM %',
    'Month-on-Month — BD Hours by Cell (2026)',
    'Month-on-Month — PM Hours by Cell (2026)',
  ])
    await expect(region(page, title)).toBeVisible();
  await expect(
    region(page, 'By Cell — Detail').getByRole('cell', { name: '36,272.45', exact: true }),
  ).toBeVisible();
  const charts = page.locator('[data-chart-state]');
  await expect(charts).toHaveCount(2);
  for (const chart of await charts.all())
    await expect(chart).toHaveAttribute('data-chart-state', 'ready');
  const cellChart = region(page, 'BD % and PM % by cell');
  await expect(cellChart).toBeVisible();
  await expect(region(page, 'BD and PM hours by month')).toBeVisible();
  await cellChart.getByText('Show the numbers', { exact: true }).click();
  await expect(cellChart.getByRole('cell', { name: '1.36', exact: true })).toBeVisible();
  expect(await noSidewaysScroll(page)).toBe(true);
});

test('Category and cell: eight charts, the two summary tables, and the machines of all categories in one table that filters by category', async ({
  page,
}) => {
  await stub(page);
  await open(page, SCREEN_A2);
  await expect(
    tabs(page).getByRole('button', { name: 'A2 category and cell', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Category and cell' })).toBeVisible();
  for (const title of ['By Category — Detail', 'By Cell — Detail', 'Machine-Level Detail'])
    await expect(region(page, title)).toBeVisible();
  const charts = page.locator('[data-chart-state]');
  await expect(charts).toHaveCount(8);
  for (const chart of await charts.all())
    await expect(chart).toHaveAttribute('data-chart-state', 'ready');
  for (const title of ['BD hours by category', 'Average breakdowns per machine by cell'])
    await expect(page.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible();
  const machines = region(page, 'Machine-Level Detail');
  const total = A2.tables.slice(2).reduce((sum, table) => sum + table.rows.length, 0);
  await expect(machines.getByText(new RegExp(`^1–10 of ${total}$`))).toBeVisible();
  await machines.getByRole('button', { name: 'Turning Center', exact: true }).click();
  await expect(machines.getByText(/^1–10 of 38$/)).toBeVisible();
  expect(await noSidewaysScroll(page)).toBe(true);
});

test('MTTR and MTBF: seven charts, the six tables with the key’s dash, and the month matrices one table per measure', async ({
  page,
}) => {
  await stub(page);
  await open(page, SCREEN_A3);
  await expect(
    tabs(page).getByRole('button', { name: 'A3 MTTR and MTBF', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'MTTR and MTBF' })).toBeVisible();
  for (const title of [
    'By Category',
    'By Cell',
    'Month-on-Month MTTR & MTBF — Cell-wise and Plant-wide · MTTR',
    'Month-on-Month MTTR & MTBF — Cell-wise and Plant-wide · MTBF',
    'Month-on-Month MTTR & MTBF — Age Band-wise and Plant-wide · MTTR',
    'Month-on-Month MTTR & MTBF — Age Band-wise and Plant-wide · MTBF',
    'By Machine Age Band',
    'By Individual Machine',
  ])
    await expect(region(page, title)).toBeVisible();
  await expect(
    region(page, 'By Category').getByRole('cell', { name: '5,183.33', exact: true }),
  ).toBeVisible();
  // The key's dash for a month with no breakdowns stays a dash.
  await expect(
    region(page, 'Month-on-Month MTTR & MTBF — Cell-wise and Plant-wide · MTTR')
      .getByRole('cell', { name: '—', exact: true })
      .first(),
  ).toBeVisible();
  const machines = A3.tables.at(-1)!.rows.length;
  await expect(
    region(page, 'By Individual Machine').getByText(new RegExp(`^1–10 of ${machines}$`)),
  ).toBeVisible();
  const charts = page.locator('[data-chart-state]');
  await expect(charts).toHaveCount(7);
  for (const chart of await charts.all())
    await expect(chart).toHaveAttribute('data-chart-state', 'ready');
  for (const title of ['MTTR by category', 'Plant MTTR and MTBF by month'])
    await expect(page.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible();
  expect(await noSidewaysScroll(page)).toBe(true);
});

test('each page opens the tickets behind it from its own action, in the drawer, and Back closes them', async ({
  page,
}) => {
  await stub(page);
  for (const screen of [SCREEN_A1, SCREEN_A2, SCREEN_A3]) {
    await open(page, screen);
    await page.getByRole('button', { name: 'See the rows', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]drawer=figure:${screen}$`));
    await expect(drawer(page).getByRole('link', { name: FIRST_REF, exact: true })).toBeVisible();
    await expect(drawer(page).getByText('2 tickets counted')).toBeVisible();
    await page.goBack();
    await expect(page).not.toHaveURL(/drawer=/);
  }
});

test('a page that counts more tickets than one drill read may take asks in runs and opens every one', async ({
  page,
}) => {
  const asked = await stub(page, ticketIds(201));
  await open(page, SCREEN_A1);
  await page.getByRole('button', { name: 'See the rows', exact: true }).click();
  await expect(drawer(page).getByText('201 tickets counted')).toBeVisible();
  expect(asked.map((ids) => ids.length).sort((a, b) => a - b)).toEqual([1, 200]);
});

test('an old v1 link with ?drill= opens the page with its rows in the drawer, never a v1 page', async ({
  page,
}) => {
  await stub(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const link = encodeURIComponent(`ticket:${ticketIds(2).join(',')}`);
  await page.goto(`${B}${SCREEN_A2}&drill=${link}`);
  await expect(page).toHaveURL(new RegExp(`[?&]drawer=figure:${SCREEN_A2}$`));
  await expect(page).not.toHaveURL(/drill=/);
  await expect(drawer(page).getByRole('link', { name: FIRST_REF, exact: true })).toBeVisible();
});

for (const theme of ['light', 'dark'] as const)
  for (const screen of [SCREEN_A1, SCREEN_A2, SCREEN_A3])
    test(`${screen}: axe finds nothing in ${theme}`, async ({ page }) => {
      await stub(page);
      await open(page, screen, theme);
      await expect(page.locator('[data-chart-state="ready"]').first()).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual(
        [],
      );
    });

test('on a phone, opening every chart’s numbers never makes the page scroll sideways', async ({
  page,
}) => {
  await stub(page);
  for (const path of [
    `${B}${SCREEN_A1}`,
    `${B}${SCREEN_A2}`,
    `${B}${SCREEN_A3}`,
    `/analytics/forecast-scorecard?screen=${SCREEN_A9}`,
  ]) {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(path);
    await expect(page.locator('[data-chart-state="ready"]').first()).toBeVisible();
    expect(await noSidewaysScroll(page), `${path} before`).toBe(true);
    const summaries = page.getByText('Show the numbers', { exact: true });
    for (const summary of await summaries.all()) await summary.click();
    await expect(page.locator('.v2-chart-numbers').first()).toBeVisible();
    expect(await noSidewaysScroll(page), `${path} with the numbers open`).toBe(true);
  }
});
