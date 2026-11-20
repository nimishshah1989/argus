import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { getJson, commandViaApi } from './fixtures-actions.js';
import { apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';

/**
 * 40e-1: the Breakdown Log, and the A1, A2 and A3 screens (A1 to A3 are v2, live at their v1 address). A head filters
 * the platform's own log, keeps its rowCount in sight, exports it and opens a ticket from a row; then opens A1 and sees
 * its figures, tables and charts, and the tickets behind it in the drawer; then A2 and A3. An operator is refused. The
 * figures reply is stubbed with the frozen keys (the established seam), so the screens are proved against the key; the
 * two tickets it drills to are real, so the drill reply is live.
 */

type Figure = FiguresReply['figures'][number];
type Ticket = { id: string; ref: string };

const AS_OF = '2026-11-11';

const LOG_HEADER = [
  '',
  'Sr No',
  'Ticket No.',
  'Date',
  'Shift',
  'Machine',
  'Problem',
  'Done By',
  'Downtime (Hrs)',
  'Code',
];

interface KeyTable {
  title: string;
  header: string[];
  rows: string[][];
}

interface KeyPage {
  kpis: { label: string; value: string; sub: string }[];
  tables: KeyTable[];
}

/** The frozen 11 November keys, read as data; never a hand-copied table. */
function keyOf(name: string): { pages: KeyPage[] } {
  return JSON.parse(
    readFileSync(new URL(`../../../fixtures/answer-key/${name}.json`, import.meta.url), 'utf8'),
  ) as { pages: KeyPage[] };
}

/** Neutral screen constants, so CI's secret scanner never reads a figure lookup as an API key. */
const SCREEN_A1 = 'a1-bd-pm';
const SCREEN_A2 = 'a2-category-cell';
const SCREEN_A3 = 'a3-mttr-mtbf';
const A1 = keyOf(SCREEN_A1).pages[0]!;
const A2 = keyOf(SCREEN_A2).pages[0]!;
const A3 = keyOf(SCREEN_A3).pages[0]!;

let tickets: { first: Ticket; second: Ticket };

test.beforeAll(async () => {
  const token = await apiLogin('head');
  const me = await getJson<{ user: { actingPersonId: string } }>(token, '/api/v1/auth/me');
  // General work, not a machine ticket: another spec on this worker may hold the machine's open slot.
  const first = await raiseTicketViaApi(token, null, 'Log: ATC trouble Machine Stop');
  const second = await raiseTicketViaApi(token, null, 'Log: phase failure');
  // Cancelled so the tickets do not sit in any desk list; the log's drill still opens their pages.
  for (const ticket of [first, second])
    await commandViaApi(token, ticket.id, 'cancel', {
      personId: me.user.actingPersonId,
      reason: 'Breakdown log spec',
    });
  tickets = { first, second };
});

/** The two newest rows, whose ticket numbers are the real tickets the drill opens. */
function logHeadRows(): string[][] {
  return [
    [
      '👁',
      '1357',
      tickets.first.ref,
      '07-11-2026',
      '2',
      'VC-15',
      'ATC trouble Machine Stop',
      'Person 41',
      '1.83',
      'ATC',
    ],
    [
      '👁',
      '1356',
      tickets.second.ref,
      '07-11-2026',
      '2',
      'VC-41',
      'Power interrupt / phase failure',
      'Person 46',
      '0.58',
      'E',
    ],
  ];
}

/** Three more rows, including the NO DT dash and the filters' other values. */
function logTailRows(): string[][] {
  return [
    [
      '👁',
      '1355',
      'BD-0144',
      '07-11-2026',
      '3',
      'HMC-2',
      'Atc Arm move to left side time out',
      'Person 46',
      '—',
      'E',
    ],
    [
      '👁',
      '1354',
      'BD-0140',
      '06-11-2026',
      '1',
      'VC-15',
      'Spindle drive alarm',
      'Person 41',
      '2.5',
      'M',
    ],
    [
      '👁',
      '1353',
      'BD-0139',
      '06-11-2026',
      '1',
      'VC-41',
      'Coolant pump leak',
      'Person 46',
      '1.5',
      'M',
    ],
  ];
}

/** The log rows the platform's key pins, with the two real ticket ids in row order. */
function logRows(): string[][] {
  return [...logHeadRows(), ...logTailRows()];
}

function logFigure(): Figure {
  return {
    key: 'breakdown-log',
    screen: 'breakdown-log',
    owner: 40,
    status: 'ready',
    value: {
      screen: 'breakdown-log',
      asOf: AS_OF,
      pages: [
        {
          page: 'breakdowns',
          title: 'Breakdown Log',
          kpis: [],
          tables: [
            {
              title: '',
              header: LOG_HEADER,
              rows: logRows(),
              rowTicketIds: [tickets.first.id, tickets.second.id, 'fake-3', 'fake-4', 'fake-5'],
              rowCount: 1343,
              truncated: true,
            },
          ],
          charts: [],
        },
      ],
    },
    // The engine sorts a figure's drill ids; here they run against the row order on purpose, so a link that
    // paired row N with drill id N would open the wrong ticket.
    drill: {
      type: 'ticket',
      ids: ['fake-5', 'fake-4', 'fake-3', tickets.second.id, tickets.first.id],
    },
  };
}

function pageFigure(screen: string, ids: string[]): Figure {
  return {
    key: screen,
    screen,
    owner: 40,
    status: 'ready',
    value: keyOf(screen),
    drill: { type: 'ticket', ids },
  };
}

/** The log and the three key pages; each page counts the same ids (the two real tickets, or `ids` when given). */
async function stubFigures(page: Page, ids?: string[]): Promise<void> {
  const counted = ids ?? [tickets.first.id, tickets.second.id];
  const reply: FiguresReply = {
    asOf: AS_OF,
    profile: {} as FiguresReply['profile'],
    excludedMachines: 0,
    rows: { machines: 125, moves: 0, tickets: 2, tasks: 0, reports: 5, people: 4 },
    figures: [
      logFigure(),
      ...[SCREEN_A1, SCREEN_A2, SCREEN_A3].map((screen) => pageFigure(screen, counted)),
    ],
  };
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: reply }));
}

/** The log opens inside the group's screen menu: platform columns, the eye, the dash and the rowCount. */
async function openLog(page: Page): Promise<void> {
  await page.goto('/analytics/breakdowns');
  await expect(page.getByRole('heading', { name: 'Breakdown Log', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Breakdowns screens', exact: true });
  await expect(nav.getByRole('link', { name: 'Breakdown log', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  for (const column of [
    'Sr No',
    'Ticket No.',
    'Date',
    'Shift',
    'Machine',
    'Problem',
    'Done By',
    'Downtime (Hrs)',
    'Code',
  ])
    await expect(page.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'ATC trouble Machine Stop', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: '—', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '1.83', exact: true })).toBeVisible();
  await expect(page.getByText('1,343 rows', { exact: true })).toBeVisible();
  await expect(page.getByText('showing the newest 5 of 1,343', { exact: true })).toBeVisible();
}

/** The four filters narrow the printed rows; the rowCount stays in sight. */
async function filterLog(page: Page): Promise<void> {
  await page.getByLabel('Date', { exact: true }).selectOption('07-11-2026');
  await page.getByLabel('Shift', { exact: true }).selectOption('2');
  await page.getByLabel('Machine', { exact: true }).selectOption('VC-15');
  await page.getByLabel('Code', { exact: true }).selectOption('ATC');
  await expect(page.getByText('1 match these filters', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'ATC trouble Machine Stop', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Power interrupt / phase failure', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('1,343 rows', { exact: true })).toBeVisible();
}

/** The client-export pattern: the filtered table, one CSV line per row, no new dependency. */
async function exportLog(page: Page): Promise<void> {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export to CSV', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^breakdown-log-\d{4}-\d{2}-\d{2}\.csv$/);
  const path = await file.path();
  expect(path).toBeTruthy();
  const csv = await readFile(path as string, 'utf8');
  const lines = csv.trimEnd().split('\n');
  expect(lines[0]).toBe('Sr No,Ticket No.,Date,Shift,Machine,Problem,Done By,Downtime (Hrs),Code');
  expect(lines).toHaveLength(2);
  expect(lines[1]).toContain('VC-15');
  expect(lines[1]).toContain('ATC trouble Machine Stop');
}

const tabs = (page: Page) => page.getByRole('group', { name: 'Breakdowns screens', exact: true });
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const range = (rows: number) => new RegExp(`^1–\\d+ of ${rows}$`);

/** Every chart the page draws is up and ready: the count the key sends, each drawn by the one chart kit. */
async function chartsReady(page: Page, count: number): Promise<void> {
  const charts = page.locator('[data-chart-state]');
  await expect(charts).toHaveCount(count);
  for (const chart of await charts.all())
    await expect(chart).toHaveAttribute('data-chart-state', 'ready');
}

/** The page action opens every ticket the figure counted, in the drawer; Back closes it. */
async function openTickets(page: Page, screen: string, ref: string): Promise<void> {
  await page.getByRole('button', { name: 'See the rows', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`[?&]drawer=figure:${screen}$`));
  await expect(
    page.locator('aside.v2-drawer').getByRole('link', { name: ref, exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/drawer=/);
}

/** A1, from the log's own screen menu: its tab, the six figures, the five tables, the two charts and the tickets behind it. */
async function openA1(page: Page): Promise<void> {
  await page.goto('/analytics/breakdowns');
  await page
    .getByRole('navigation', { name: 'Breakdowns screens', exact: true })
    .getByRole('link', { name: 'A1 breakdown percent and PM split', exact: true })
    .click();
  await expect(page).toHaveURL(/screen=a1-bd-pm/);
  await expect(
    tabs(page).getByRole('button', { name: 'A1 breakdown percent and PM split', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'BD % and PM split' })).toBeVisible();
  expect(A1.kpis).toHaveLength(6);
  for (const kpi of A1.kpis) {
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
  await chartsReady(page, 2);
  const cellChart = region(page, 'BD % and PM % by cell');
  await expect(cellChart).toBeVisible();
  await expect(region(page, 'BD and PM hours by month')).toBeVisible();
  await cellChart.getByText('Show the numbers', { exact: true }).click();
  await expect(cellChart.getByRole('cell', { name: '1.36', exact: true })).toBeVisible();
  await openTickets(page, SCREEN_A1, tickets.first.ref);
}

/** A2 in the group's tabs: its title, the two summary tables, every machine in one table, 8 charts and its tickets. */
async function openA2(page: Page): Promise<void> {
  await page.goto('/analytics/breakdowns');
  await page
    .getByRole('navigation', { name: 'Breakdowns screens', exact: true })
    .getByRole('link', { name: 'A2 category and cell', exact: true })
    .click();
  await expect(page).toHaveURL(/screen=a2-category-cell/);
  await expect(
    tabs(page).getByRole('button', { name: 'A2 category and cell', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Category and cell' })).toBeVisible();
  for (const title of ['By Category — Detail', 'By Cell — Detail', 'Machine-Level Detail'])
    await expect(region(page, title)).toBeVisible();
  await expect(
    region(page, 'By Category — Detail').getByRole('cell', {
      name: 'Cnc Sliding Head Automatic Lathe',
      exact: true,
    }),
  ).toBeVisible();
  // The fourteen machine tables the key prints (one a category) are one table here, every machine kept.
  const machineRows = A2.tables.slice(2).reduce((sum, table) => sum + table.rows.length, 0);
  const machines = region(page, 'Machine-Level Detail');
  await expect(machines.getByText(range(machineRows))).toBeVisible();
  await machines.getByRole('button', { name: 'Turning Center', exact: true }).click();
  await expect(machines.getByText(range(38))).toBeVisible();
  await chartsReady(page, 8);
  for (const title of ['BD hours by category', 'Average breakdowns per machine by cell'])
    await expect(page.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible();
  await openTickets(page, SCREEN_A2, tickets.first.ref);
}

/** A3 in the group's tabs: its title, six tables (the month matrices one table per measure), 7 charts and its tickets. */
async function openA3(page: Page): Promise<void> {
  await page.goto('/analytics/breakdowns');
  await page
    .getByRole('navigation', { name: 'Breakdowns screens', exact: true })
    .getByRole('link', { name: 'A3 MTTR and MTBF', exact: true })
    .click();
  await expect(page).toHaveURL(/screen=a3-mttr-mtbf/);
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
  await expect(
    region(page, 'By Individual Machine').getByText(range(A3.tables.at(-1)!.rows.length)),
  ).toBeVisible();
  await chartsReady(page, 7);
  for (const title of ['MTTR by category', 'Plant MTTR and MTBF by month'])
    await expect(page.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible();
  await openTickets(page, SCREEN_A3, tickets.second.ref);
}

test('a head opens A2 and A3, sees their tables and charts, and opens the tickets behind them', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');
  await openA2(page);
  await openA3(page);
});

test('a head filters the Breakdown Log, keeps its count, exports it and opens a ticket, then opens A1', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');
  await openLog(page);
  await filterLog(page);
  await exportLog(page);
  await page.getByRole('link', { name: 'Open the ticket for Sr No 1357', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/desk/${tickets.first.id}$`));
  await expect(
    page.getByRole('heading', { name: tickets.first.ref, exact: true }).first(),
  ).toBeVisible();
  await openA1(page);
});

test('A1 over the drill cap reads its tickets in runs the server accepts, and opens them all', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const over = Array.from({ length: 201 }, (_, index) => `over-cap-${index}`);
  await stubFigures(page, over);
  await signIn(page, 'head');
  const asked: number[] = [];
  await page.route('**/api/v1/analytics/drill**', (route) => {
    const ids = new URL(route.request().url()).searchParams.get('ids') ?? '';
    asked.push(ids.split(',').length);
    const rows = ids.split(',').map((id, at) => ({
      id: `00000000-0000-4000-8000-${String(at + 1).padStart(12, '0')}`,
      ref: `BD-${id}`,
      kind: 'stopped',
      status: 'closed',
      machineId: null,
      reportedAt: '2026-11-07T08:00:00.000Z',
      closedAt: '2026-11-07T09:30:00.000Z',
      source: 'history',
      downtimeMin: 90,
      repairMin: 60,
      workType: null,
    }));
    return route.fulfill({ json: { type: 'ticket', rows } });
  });
  await page.goto('/analytics/breakdowns?screen=a1-bd-pm');
  await expect(page.getByRole('heading', { level: 1, name: 'BD % and PM split' })).toBeVisible();
  await page.getByRole('button', { name: 'See the rows', exact: true }).click();
  await expect(page).toHaveURL(/[?&]drawer=figure:a1-bd-pm$/);
  await expect.poll(() => [...asked].sort((a, b) => a - b)).toEqual([1, 200]);
  await expect(page.locator('aside.v2-drawer').getByText('201 tickets counted')).toBeVisible();
});

test('an old v1 link with ?drill= opens the page with its tickets in the drawer, never a v1 page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');
  const link = encodeURIComponent(`ticket:${tickets.first.id},${tickets.second.id}`);
  for (const screen of [SCREEN_A1, SCREEN_A2, SCREEN_A3]) {
    await page.goto(`/analytics/breakdowns?screen=${screen}&drill=${link}`);
    await expect(page).toHaveURL(new RegExp(`[?&]drawer=figure:${screen}$`));
    await expect(page).not.toHaveURL(/drill=/);
    await expect(
      page.locator('aside.v2-drawer').getByRole('link', { name: tickets.first.ref, exact: true }),
    ).toBeVisible();
  }
});

test('an operator is refused the breakdowns face', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'op');

  await page.goto('/analytics/breakdowns');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Breakdown Log', exact: true })).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export to CSV', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('navigation', { name: 'Breakdowns screens', exact: true }),
  ).toHaveCount(0);
  for (const screen of [SCREEN_A1, SCREEN_A2, SCREEN_A3]) {
    await page.goto(`/analytics/breakdowns?screen=${screen}`);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.locator('[data-chart-state]')).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Breakdowns screens', exact: true })).toHaveCount(
      0,
    );
  }
});
