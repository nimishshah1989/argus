import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { getJson, commandViaApi } from './fixtures-actions.js';
import { apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';

/**
 * 40e-1: the Breakdown Log and A1 screens. A head filters the platform's own log, keeps its rowCount in sight,
 * exports it and opens a ticket from a row; then opens A1 and sees its KPIs, tables and charts. An operator is
 * refused. The figures reply is stubbed (the established seam) so the journey proves the screens, not packet
 * 40a/40b's progress; the two tickets it drills to are real so the ticket page and the drill reply are live.
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

const A1_KPIS = [
  {
    label: 'Avg Available Hrs / Machine',
    value: '4,525.54',
    sub: 'hours to 11 Nov · annual 6,000 from Settings',
  },
  { label: 'Total Machines', value: '125', sub: 'machines counted in production data' },
  { label: 'Total Available Hrs', value: '5,65,692.47', sub: 'whole plant' },
  { label: 'Actual Breakdown', value: '3,060.1 hrs', sub: '0.54% of available' },
  { label: 'PM Downtime', value: '759.3 hrs', sub: '0.13% of available' },
  { label: 'Fleet Availability', value: '99.32%', sub: 'BD + PM excluded' },
];

const A1_TABLES = [
  {
    title: 'By Cell — Detail',
    header: ['Cell', 'Machines', 'Available Hrs', 'BD Hrs', 'BD %', 'PM Hrs', 'PM %', 'Total %'],
    rows: [
      ['Cell 1', '7', '36,272.45', '492.21', '1.36%', '7.62', '0.02%', '1.38%'],
      ['Cell 2', '25', '1,21,284.81', '317.87', '0.26%', '328.14', '0.27%', '0.53%'],
    ],
    rowCount: 9,
  },
  {
    title: 'Month-on-Month — BD % and PM % (2026)',
    header: ['Cell', 'Jan', 'Feb', 'Q1 Avg', 'Year 2026'],
    rows: [
      ['Cell 1BD % / PM %', '0.34%', '0.35%', '0.59%', '1.36%'],
      ['0.00%', '0.00%', '0.21%', '0.07%', '0.02%'],
    ],
    rowCount: 20,
  },
  {
    title: 'Month-on-Month — BD Hours by Cell (2026)',
    header: ['Cell', 'Jan', 'Feb', 'Total'],
    rows: [['Cell 1', '53.2010.1%', '48.779.2%', '685.58']],
    rowCount: 9,
  },
  {
    title: 'Month-on-Month — PM Hours by Cell (2026)',
    header: ['Cell', 'Jan', 'Feb', 'Total'],
    rows: [['Cell 1', '1.9', '—', '7.62']],
    rowCount: 9,
  },
];

const A1_CHARTS = [
  {
    id: 'ch-a1-cell',
    type: 'bar',
    axes: { x: '', y: '' },
    tickLabels: { x: [], y: [] },
    labels: ['Cell 1', 'Cell 2'],
    datasets: [
      { label: 'BD %', data: [1.36, 0.26] },
      { label: 'PM %', data: [0.02, 0.27] },
    ],
  },
  {
    id: 'ch-a1-trend',
    type: 'line',
    axes: { x: '', y: '' },
    tickLabels: { x: [], y: [] },
    labels: ['Jan', 'Feb'],
    datasets: [
      { label: 'BD Hrs', data: [248.95000000000002, 302.81] },
      { label: 'PM Hrs', data: [13.83, 0] },
    ],
  },
];

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
              rowCount: 1343,
              truncated: true,
            },
          ],
          charts: [],
        },
      ],
    },
    drill: {
      type: 'ticket',
      ids: [tickets.first.id, tickets.second.id, 'fake-3', 'fake-4', 'fake-5'],
    },
  };
}

function a1Figure(): Figure {
  return {
    key: 'a1-bd-pm',
    screen: 'a1-bd-pm',
    owner: 40,
    status: 'ready',
    value: {
      screen: 'a1-bd-pm',
      asOf: AS_OF,
      pages: [
        {
          page: 'a1',
          title: 'BD % & PM Split',
          kpis: A1_KPIS,
          tables: A1_TABLES,
          charts: A1_CHARTS,
        },
      ],
    },
    drill: { type: 'ticket', ids: [tickets.first.id, tickets.second.id] },
  };
}

/** A1 with more drill ids than the endpoint's cap: the page must offer the log, not a refused drill. */
function a1OverCapFigure(): Figure {
  const figure = a1Figure();
  return {
    ...figure,
    drill: {
      type: 'ticket',
      ids: Array.from({ length: 201 }, (_, index) => `over-cap-${index}`),
    },
  };
}

async function stubFigures(page: Page, a1: Figure = a1Figure()): Promise<void> {
  const reply: FiguresReply = {
    asOf: AS_OF,
    profile: {} as FiguresReply['profile'],
    rows: { machines: 125, moves: 0, tickets: 2, tasks: 0, reports: 5, people: 4 },
    figures: [logFigure(), a1],
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

/** A1: the six KPIs, the four tables, the two charts and one drill into the rows. */
async function openA1(page: Page): Promise<void> {
  await page.goto('/analytics/breakdowns');
  await page
    .getByRole('navigation', { name: 'Breakdowns screens', exact: true })
    .getByRole('link', { name: 'A1 breakdown percent and PM split', exact: true })
    .click();
  await expect(page).toHaveURL(/screen=a1-bd-pm/);
  await expect(page.getByRole('heading', { name: 'BD % & PM Split', exact: true })).toBeVisible();
  for (const kpi of A1_KPIS) {
    await expect(page.getByText(kpi.label, { exact: true })).toBeVisible();
    await expect(page.getByText(kpi.value, { exact: true })).toBeVisible();
  }
  for (const title of [
    'By Cell — Detail',
    'Month-on-Month — BD % and PM % (2026)',
    'Month-on-Month — BD Hours by Cell (2026)',
    'Month-on-Month — PM Hours by Cell (2026)',
  ])
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '36,272.45', exact: true })).toBeVisible();
  const charts = page.getByTestId('chart');
  await expect(charts).toHaveCount(2);
  await expect(charts.nth(0)).toHaveAttribute('data-chart-state', 'ready');
  await expect(charts.nth(1)).toHaveAttribute('data-chart-state', 'ready');
  await expect(page.getByText('BD % and PM % by cell', { exact: true })).toBeVisible();
  await expect(page.getByText('BD and PM hours by month', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'See the rows', exact: true }).click();
  await expect(page).toHaveURL(/drill=ticket%3A/);
  await expect(
    page.getByRole('heading', { name: 'The rows behind this figure', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: tickets.first.ref, exact: true })).toBeVisible();
}

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

test('A1 over the drill cap offers the log instead of a refused drill', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page, a1OverCapFigure());
  await signIn(page, 'head');
  const drillRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/analytics/drill')) drillRequests.push(request.url());
  });
  await page.goto('/analytics/breakdowns?screen=a1-bd-pm');
  await expect(page.getByRole('heading', { name: 'BD % & PM Split', exact: true })).toBeVisible();
  await expect(
    page.getByText('201 tickets are behind this page; open them one by one in the Breakdown log.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'See the rows', exact: true })).toHaveCount(0);
  const logLink = page.getByRole('link', { name: 'Open the Breakdown log', exact: true });
  await expect(logLink).toHaveAttribute('href', '/analytics/breakdowns?screen=breakdown-log');
  await logLink.click();
  await expect(page).toHaveURL(/screen=breakdown-log/);
  await expect(page.getByRole('heading', { name: 'Breakdown Log', exact: true })).toBeVisible();
  expect(drillRequests).toEqual([]);
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
});
