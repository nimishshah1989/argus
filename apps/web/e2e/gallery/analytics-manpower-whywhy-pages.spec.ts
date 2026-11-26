import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import { mockPlant } from './plant-mock.js';

/**
 * Manpower and Why-Why, live at their v1 address in the real app (router, shell, live reader, rows panel), with the
 * engine's frozen answer for the 11 November plant as the figures reply. No database: the API is answered in the
 * browser, so the Why-Why save is checked by the ticket it is sent to. The real-server run is
 * `e2e/analytics-manpower.spec.ts` and `e2e/analytics-whywhy.spec.ts`.
 */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const B = '/analytics/breakdowns?screen=';
const A4 = 'a4-manpower';
const A6 = 'a6-why-why';

type KeyPage = { tables: { title: string; rows: string[][] }[] };
const keyOf = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../../fixtures/answer-key/${name}.json`, import.meta.url), 'utf8'),
  ) as { pages: KeyPage[] };

const ticket = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
/** The first (worst) row's ticket sorts LAST, as it can in the engine: a row is never paired with a ticket by its place in the sorted drill. */
const ROWS = keyOf(A6).pages[0]!.tables[0]!.rows;
const ROW_TICKETS = ROWS.map((_, at) => ticket(900 - at));
const drawer = (page: Page) => page.locator('aside.v2-drawer');
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

/** The rows behind a figure: a closed breakdown for every ticket id the page asks for. */
async function stubDrill(page: Page): Promise<void> {
  await page.route('**/api/v1/analytics/drill**', (route: Route) => {
    const wanted = (new URL(route.request().url()).searchParams.get('ids') ?? '').split(',');
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
}

async function stub(page: Page): Promise<{ saved: string[] }> {
  const saved: string[] = [];
  const a6 = keyOf(A6);
  a6.pages[0]!.tables[0] = {
    ...a6.pages[0]!.tables[0]!,
    rowTicketIds: ROW_TICKETS,
  } as KeyPage['tables'][number];
  const figure = (key: string, value: unknown, ids: string[]) => ({
    key,
    screen: key,
    owner: 41,
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
        rows: { machines: 125, moves: 0, tickets: 2, tasks: 0, reports: 0, people: 0 },
        figures: [
          figure(A4, keyOf(A4), [ticket(1), ticket(2)]),
          figure(A6, a6, [...ROW_TICKETS].sort()),
        ],
      },
    }),
  );
  await stubDrill(page);
  await page.route('**/api/v1/tickets/*/why-why', (route: Route) => {
    const request = route.request();
    if (request.method() === 'PUT') {
      saved.push(request.url().split('/tickets/')[1]!.split('/')[0]!);
      return route.fulfill({
        json: {
          ...(request.postDataJSON() as object),
          completedBy: ticket(5),
          completedDate: '2026-11-11',
        },
      });
    }
    return route.fulfill({ json: null });
  });
  return { saved };
}

async function open(page: Page, screen: string, theme: 'light' | 'dark' = 'light') {
  await page.emulateMedia({ colorScheme: theme });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${B}${screen}`);
  await page.mouse.move(900, 700);
}

const noSidewaysScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test('Manpower: its tab is pressed, the figures, chart and tables are up, the numbers sit behind the chart, and the toggle keeps the fault-code form', async ({
  page,
}) => {
  await stub(page);
  await open(page, A4);
  await expect(
    page
      .getByRole('group', { name: 'Breakdowns screens', exact: true })
      .getByRole('button', { name: 'Manpower', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Manpower' })).toBeVisible();
  for (const label of ['Total Breakdowns', 'Total BD Hours', 'Team Members Tracked'])
    await expect(region(page, label).first()).toBeVisible();
  await expect(region(page, 'Manpower Table')).toBeVisible();
  const chart = region(page, 'Breakdowns handled — Done By');
  await expect(chart).toBeVisible();
  await expect(page.locator('[data-chart-state]')).toHaveAttribute('data-chart-state', 'ready');
  await chart.getByText('Show the numbers', { exact: true }).click();
  await expect(chart.getByRole('cell', { name: '197', exact: true })).toBeVisible();
  const toggle = page.getByRole('group', { name: 'Specialization view', exact: true });
  await toggle.getByRole('button', { name: 'By Fault Code', exact: true }).click();
  await expect(page.getByText('Not computed yet', { exact: true })).toBeVisible();
  await toggle.getByRole('button', { name: 'By Category', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Turning Cen…', exact: true })).toBeVisible();
  expect(await noSidewaysScroll(page)).toBe(true);
});

test('Why-Why: Start on the first row saves on that row’s own ticket, never on the one its place in the sorted drill would give', async ({
  page,
}) => {
  const { saved } = await stub(page);
  await open(page, A6);
  await expect(page.getByRole('heading', { level: 1, name: 'Why-Why', exact: true })).toBeVisible();
  await expect(page.getByText(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/)).toHaveCount(0);
  const table = region(page, 'Breakdowns that ran past the Why-Why limit');
  await table.getByRole('row').nth(1).getByRole('button', { name: 'Start Why-Why' }).click();
  const form = page.getByRole('form', { name: 'Why-Why form', exact: true });
  await form.getByLabel('Why 1', { exact: true }).fill('The spindle stopped');
  await form.getByLabel('Conclusion (required)', { exact: true }).fill('The bearing was worn.');
  await form.getByRole('button', { name: 'Save Why-Why', exact: true }).click();
  await expect(form.getByText('Saved.', { exact: true })).toBeVisible();
  expect(saved).toEqual([ROW_TICKETS[0]]);
});

test('each page opens the tickets behind it from its own action, in the drawer, and an old ?drill= link lands on them', async ({
  page,
}) => {
  await stub(page);
  for (const screen of [A4, A6]) {
    await open(page, screen);
    await page.getByRole('button', { name: /Show the rows behind/ }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]drawer=figure:${screen}$`));
    await expect(drawer(page).getByRole('link').first()).toBeVisible();
    await page.goBack();
    await expect(page).not.toHaveURL(/drawer=/);
    const link = encodeURIComponent(`ticket:${ticket(1)},${ticket(2)}`);
    await page.goto(`${B}${screen}&drill=${link}`);
    await expect(page).toHaveURL(/[?&]drawer=figure:/);
    await expect(page).not.toHaveURL(/drill=/);
  }
});

for (const theme of ['light', 'dark'] as const)
  for (const screen of [A4, A6])
    test(`${screen}: axe finds nothing in ${theme}, with the chart numbers or the form open`, async ({
      page,
    }) => {
      await stub(page);
      await open(page, screen, theme);
      if (screen === A4) {
        await expect(page.locator('[data-chart-state="ready"]').first()).toBeVisible();
        await page.getByText('Show the numbers', { exact: true }).first().click();
      } else {
        await region(page, 'Breakdowns that ran past the Why-Why limit')
          .getByRole('button', { name: 'Start Why-Why' })
          .first()
          .click();
        await expect(page.getByRole('form', { name: 'Why-Why form', exact: true })).toBeVisible();
      }
      const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual(
        [],
      );
    });

test('on a phone, Manpower with the chart numbers open and Why-Why with its form open never scroll sideways', async ({
  page,
}) => {
  await stub(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${B}${A4}`);
  await expect(page.locator('[data-chart-state="ready"]').first()).toBeVisible();
  for (const summary of await page.getByText('Show the numbers', { exact: true }).all())
    await summary.click();
  await expect(page.locator('.v2-chart-numbers').first()).toBeVisible();
  expect(await noSidewaysScroll(page)).toBe(true);
  await page.goto(`${B}${A6}`);
  await region(page, 'Breakdowns that ran past the Why-Why limit')
    .getByRole('button', { name: 'Start Why-Why' })
    .first()
    .click();
  await expect(page.getByRole('form', { name: 'Why-Why form', exact: true })).toBeVisible();
  expect(await noSidewaysScroll(page)).toBe(true);
});
