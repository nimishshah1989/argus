import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';

/**
 * 48c: the shift-calendar KPIs screen. A head opens Breakdowns then Shift-calendar KPIs, reads the platform column
 * beside the working-hour column, reads a cell of the breakdown map's heat grids, sees the four Paretos as ranked bars and
 * drills from the map to the rows behind it. An operator is refused, as for every analytics screen. The figures
 * reply is stubbed (the established seam), so the journey proves the screen and the chart chrome, not the engine;
 * the two tickets the drill names are real, so the drill reply is live.
 */

type Figure = FiguresReply['figures'][number];
type Ticket = { id: string; ref: string };

const AS_OF = '2026-11-11';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];

const COMPARE_HEADER = ['Measure', 'Platform basis', 'Working-hour basis'];
const COMPARE_ROWS = [
  ['MTBF (hours)', '439.9', '462.0'],
  ['MTTR (hours)', '2.39', '2.39'],
  ['Availability (%)', '99.32', '99.36'],
  ['Breakdown %', '0.54', '0.51'],
  ['PM %', '0.13', '0.13'],
];

const SPLIT_HEADER = [
  'Shift',
  'Breakdowns',
  'BD hours',
  'PM hours',
  'Working hours',
  'MTTR',
  'MTBF',
  'Availability',
];
const SPLIT_ROWS = [
  ['1 (08:00–18:29)', '821', '2,021.10', '571.28', '2,96,517.14', '2.46', '358.7', '99.13'],
  ['2 (18:29–05:00)', '456', '1,031.12', '187.98', '2,97,459.96', '2.26', '650.1', '99.59'],
  ['3 (no window)', '2', '3.00', '0.00', '—', '—', '—', '—'],
  ['PLANT TOTAL', '1,279', '3,055.22', '759.27', '5,93,977.10', '2.39', '462.0', '99.36'],
];

/** One month column's cells, dashes where the plant recorded no hours. */
function heatRows(
  labels: readonly string[],
  months: readonly string[][],
  totals: readonly string[],
  cumulative: readonly string[],
): string[][] {
  return labels.map((label, index) => [
    label,
    ...(months[index] ?? []),
    totals[index]!,
    cumulative[index]!,
  ]);
}

type StubTable = {
  title: string;
  header: string[];
  rows: string[][];
  rowCount: number;
  heat: true;
};

function heatTable(title: string, first: string, rows: string[][]): StubTable {
  return {
    title,
    header: [first, ...MONTHS, 'Total', 'Cumulative %'],
    rows,
    rowCount: rows.length,
    heat: true,
  };
}

const MACHINE_ROWS = heatRows(
  ['TMC-2', 'TC-5', 'VC-28'],
  [
    ['1.50', '1.08', '—', '39.33', '6.00', '242.42', '6.67', '10.25', '0.33', '—', '—'],
    ['12.00', '—', '4.50', '31.20', '—', '18.30', '9.10', '—', '20.00', '15.00', '8.00'],
    ['—', '—', '40.00', '—', '12.10', '—', '—', '20.00', '—', '35.00', '44.22'],
  ],
  ['307.58', '175.08', '151.32'],
  ['10.07', '15.80', '20.75'],
);

const CELL_ROWS = heatRows(
  ['7', '2', '6'],
  [
    ['120.00', '—', '80.00', '200.00', '—', '—', '160.00', '—', '—', '216.78', '—'],
    ['90.00', '60.00', '—', '—', '110.00', '—', '—', '181.17', '—', '—', '180.00'],
    ['—', '70.00', '—', '140.00', '—', '100.00', '—', '—', '150.00', '—', '133.57'],
  ],
  ['776.78', '621.17', '593.57'],
  ['25.42', '45.75', '65.18'],
);

const CODE_ROWS = heatRows(
  ['E Electronics/Electrical', 'M Mechanical', 'HUM Human Mistake'],
  [
    [
      '17.00',
      '18.58',
      '22.83',
      '260.67',
      '9.53',
      '96.62',
      '116.22',
      '21.85',
      '55.35',
      '56.38',
      '12.57',
    ],
    ['60.00', '70.00', '55.00', '90.00', '—', '80.00', '61.65', '50.00', '60.00', '70.00', '70.00'],
    ['—', '40.00', '30.00', '—', '50.00', '60.00', '40.98', '—', '90.00', '80.00', '50.00'],
  ],
  ['687.60', '666.65', '440.98'],
  ['22.51', '44.32', '58.75'],
);

const SHIFT_ROWS = heatRows(
  ['1', '2', '3'],
  [
    [
      '176.65',
      '170.92',
      '130.42',
      '338.12',
      '56.53',
      '458.65',
      '171.23',
      '163.13',
      '129.08',
      '191.17',
      '35.20',
    ],
    [
      '90.00',
      '110.00',
      '80.00',
      '120.00',
      '70.00',
      '180.00',
      '60.00',
      '90.00',
      '80.00',
      '100.00',
      '51.12',
    ],
    ['1.00', '—', '—', '2.00', '—', '—', '—', '—', '—', '—', '—'],
  ],
  ['2,021.10', '1,031.12', '3.00'],
  ['66.15', '99.90', '100.00'],
);

function chart(
  id: string,
  labels: readonly string[],
  hours: readonly number[],
  share: readonly number[],
) {
  return {
    id,
    type: 'mixed',
    axes: { x: '', y: '', y1: '' },
    tickLabels: { x: [], y: [], y1: [] },
    labels,
    datasets: [
      { label: 'BD hours', data: hours },
      { label: 'Cumulative %', data: share },
    ],
  };
}

function compareFigure(): Figure {
  return {
    key: 'shift-kpis.compare',
    screen: 'shift-kpis',
    owner: 48,
    status: 'ready',
    value: {
      screen: 'shift-kpis',
      asOf: AS_OF,
      pages: [
        {
          page: 'shift-kpis',
          title: 'Shift-calendar KPIs',
          kpis: [
            {
              label: 'Working Hours / Day',
              value: '21.0',
              sub: 'the plant’s active shift windows',
            },
            {
              label: 'Working Hours',
              value: '5,93,977.10',
              sub: 'to 11 Nov 2026 · 6,300 a machine a year',
            },
            { label: 'Failures', value: '1,279', sub: 'non-PM breakdowns, history and live' },
            {
              label: 'Machines Without a Failure',
              value: '8',
              sub: '125 machines in production data',
            },
          ],
          tables: [
            {
              title: 'The platform basis beside the working-hour basis',
              header: COMPARE_HEADER,
              rows: COMPARE_ROWS,
              rowCount: COMPARE_ROWS.length,
            },
          ],
          charts: [],
        },
      ],
    },
    drill: { type: 'ticket', ids: [] },
  };
}

function splitFigure(): Figure {
  return {
    key: 'shift-kpis.shift-split',
    screen: 'shift-kpis',
    owner: 48,
    status: 'ready',
    value: {
      screen: 'shift-kpis',
      asOf: AS_OF,
      pages: [
        {
          page: 'shift-kpis',
          title: 'The shift split',
          kpis: [],
          tables: [
            {
              title: 'Breakdowns, hours and MTTR by shift',
              header: SPLIT_HEADER,
              rows: SPLIT_ROWS,
              rowCount: SPLIT_ROWS.length,
            },
          ],
          charts: [],
        },
      ],
    },
    drill: { type: 'ticket', ids: [] },
  };
}

function backlogFigure(tickets: readonly Ticket[]): Figure {
  return {
    key: 'shift-kpis.backlog',
    screen: 'shift-kpis',
    owner: 48,
    status: 'ready',
    value: {
      screen: 'shift-kpis',
      asOf: AS_OF,
      pages: [
        {
          page: 'shift-kpis',
          title: 'Breakdown backlog',
          kpis: [
            { label: 'Open Breakdowns', value: '2', sub: 'still open on 11-11-2026' },
            { label: 'Oldest', value: '36.0', sub: 'working hours' },
          ],
          tables: [
            {
              title: 'The backlog, oldest first',
              header: ['Ticket', 'Machine', 'Status', 'Reported', 'Age (working hours)'],
              rows: tickets.map((ticket) => [ticket.ref, 'VC-15', 'closed', '10-11-2026', '36.0']),
              rowCount: tickets.length,
            },
          ],
          charts: [],
        },
      ],
    },
    drill: { type: 'ticket', ids: tickets.map((ticket) => ticket.id) },
  };
}

function mapFigure(tickets: readonly Ticket[]): Figure {
  return {
    key: 'shift-kpis.breakdown-map',
    screen: 'shift-kpis',
    owner: 48,
    status: 'ready',
    value: {
      screen: 'shift-kpis',
      asOf: AS_OF,
      pages: [
        {
          page: 'shift-kpis',
          title: 'Breakdown map',
          kpis: [
            { label: 'Machines for half the hours', value: '13 of 125', sub: 'worst first' },
            { label: 'Cells for half the hours', value: '3 of 9', sub: 'worst first' },
            { label: 'Codes for half the hours', value: '3 of 23', sub: 'worst first' },
            { label: 'Shifts for half the hours', value: '1 of 3', sub: 'worst first' },
          ],
          tables: [
            heatTable(
              'By machine — BD hours by month (top 15 of 117 machines, 102 left out)',
              'Machine',
              MACHINE_ROWS,
            ),
            heatTable('By cell — BD hours by month', 'Cell', CELL_ROWS),
            heatTable('By code — BD hours by month', 'Code', CODE_ROWS),
            heatTable('By shift — BD hours by month', 'Shift', SHIFT_ROWS),
          ],
          charts: [
            chart('ch-sk-machine', ['TMC-2', 'TC-5'], [307.58, 175.08], [10.07, 15.8]),
            chart('ch-sk-cell', ['7', '2'], [776.78, 621.17], [25.42, 45.75]),
            chart('ch-sk-code', ['E', 'M'], [687.6, 666.65], [22.51, 44.32]),
            chart('ch-sk-shift', ['1', '2', '3'], [2021.1, 1031.12, 3], [66.15, 99.9, 100]),
          ],
        },
      ],
    },
    drill: { type: 'ticket', ids: tickets.map((ticket) => ticket.id) },
  };
}

async function stubFigures(page: Page, tickets: readonly Ticket[]): Promise<void> {
  const reply: FiguresReply = {
    asOf: AS_OF,
    profile: {} as FiguresReply['profile'],
    excludedMachines: 0,
    rows: { machines: 125, moves: 0, tickets: 2, tasks: 0, reports: 5, people: 4 },
    figures: [compareFigure(), splitFigure(), backlogFigure(tickets), mapFigure(tickets)],
  };
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: reply }));
}

let tickets: { first: Ticket; second: Ticket };

test.beforeAll(async () => {
  const token = await apiLogin('head');
  // General work, not a machine ticket: another spec on this worker may hold the machine's open slot.
  const first = await raiseTicketViaApi(token, null, 'Shift KPIs: hydraulic leak');
  const second = await raiseTicketViaApi(token, null, 'Shift KPIs: spindle alarm');
  tickets = { first, second };
});

/** Opens the screen, checks it is the pressed tab of its group and reads the comparison row. */
async function openShiftKpis(page: Page): Promise<void> {
  await page.goto('/analytics/breakdowns?screen=shift-kpis');
  const tabs = page.getByRole('group', { name: 'Breakdowns screens', exact: true });
  await expect(
    tabs.getByRole('button', { name: 'Shift-calendar KPIs', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Shift-calendar KPIs' })).toBeVisible();
  // The compare row: the platform's frozen cell beside the working-hour basis.
  const compare = page.getByRole('region', {
    name: 'The platform basis beside the working-hour basis',
    exact: true,
  });
  await expect(compare.getByRole('cell', { name: 'MTBF (hours)', exact: true })).toBeVisible();
  await expect(compare.getByRole('cell', { name: '439.9', exact: true })).toBeVisible();
  await expect(compare.getByRole('cell', { name: '462.0', exact: true })).toBeVisible();
  await expect(page.getByText('21.0', { exact: true })).toBeVisible();
  // The answer first, in the engine's own figures.
  await expect(page.getByText(/462\.0 hrs between breakdowns/)).toBeVisible();
}

/**
 * The map: three heat grids and one ranked list, a named worst machine, its hours and its half-the-hours point. The
 * cell grid is mostly dashes (18 of 33 cells), so it is drawn as each cell's total, largest first (ADR 0036 R22).
 */
async function readMap(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Breakdown map', exact: true })).toBeVisible();
  await expect(page.locator('[data-heat="matrix"]')).toHaveCount(3);
  const cells = page.getByRole('list', { name: 'By cell — BD hours by month', exact: true });
  // One row per cell (the half-the-hours marker is a list item too, so the rows are counted by their class).
  const ranked = cells.locator('.v2-ranked-row');
  await expect(ranked).toHaveCount(3);
  await expect(ranked.first()).toContainText('Cell 7');
  await expect(ranked.first()).toContainText('776.78 · 39%');
  // A cell in the list still opens its drawer; Back closes it.
  await cells.getByRole('button', { name: 'Cell 7', exact: true }).click();
  await expect(page).toHaveURL(/[?&]drawer=cell:Cell(%20| )7$/);
  await page.goBack();
  await expect(page).not.toHaveURL(/drawer=/);
  const machines = page.getByRole('table', { name: /^By machine/ });
  await expect(machines.getByRole('button', { name: 'TMC-2', exact: true })).toBeVisible();
  await expect(machines.getByRole('cell', { name: '307.58', exact: true })).toBeVisible();
  const map = page.getByRole('region', { name: 'Breakdown map', exact: true });
  await expect(map.getByText('13 of 125', { exact: true })).toBeVisible();
  // A heat cell is tinted by weight, prints its figure and is named by its row and month for a screen reader.
  const hot = machines.getByRole('cell', { name: 'TMC-2, Jun: 242.42', exact: true });
  await expect(hot).toHaveText('242.42');
  await expect(hot).toHaveAttribute('data-level', '5');
  await expect(
    machines.getByRole('cell', { name: 'TMC-2, Mar: no hours', exact: true }),
  ).not.toHaveAttribute('data-level', /.+/);
  // Sweep 706 (ADR 0043): the four Paretos are ranked bar lists now, each under its own title; no chart is left. Five
  // lists: the four Paretos plus the cell map above (ADR 0036 R22).
  await expect(page.locator('[data-chart-state]')).toHaveCount(0);
  await expect(page.locator('ol.v2-ranked')).toHaveCount(5);
  await expect(
    page.getByRole('heading', { name: 'BD hours by machine — Pareto', exact: true }),
  ).toBeVisible();
}

test('a head opens Shift-calendar KPIs, reads the compare row and a map cell, and drills the map', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page, [tickets.first, tickets.second]);
  await signIn(page, 'head');
  await openShiftKpis(page);
  await readMap(page);
  // The backlog's own count is the number of tickets behind it, so the count opens them.
  await page.getByRole('button', { name: /Show the rows behind Open breakdowns/ }).click();
  await expect(page).toHaveURL(/[?&]drawer=figure:shift-kpis\.backlog$/);
  await expect(
    page.locator('aside.v2-drawer').getByRole('link', { name: tickets.first.ref, exact: true }),
  ).toBeVisible();
  await page.goBack();
  // The map's rows open from its section's own action, in the drawer; Back closes them.
  await page.getByRole('button', { name: /Show the rows behind Pareto and heat grids/ }).click();
  await expect(page).toHaveURL(/[?&]drawer=figure:shift-kpis\.breakdown-map$/);
  const drawer = page.locator('aside.v2-drawer');
  await expect(drawer.getByRole('link', { name: tickets.first.ref, exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/drawer=/);
});

test('an old v1 link to the shift screen opens the screen with the rows of its figure, not a v1 page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page, [tickets.first, tickets.second]);
  await signIn(page, 'head');
  const link = encodeURIComponent(`ticket:${tickets.first.id},${tickets.second.id}`);
  await page.goto(`/analytics/breakdowns?screen=shift-kpis&drill=${link}`);
  await expect(page).toHaveURL(/screen=shift-kpis/);
  await expect(page).not.toHaveURL(/drill=/);
  await expect(page.getByRole('heading', { level: 1, name: 'Shift-calendar KPIs' })).toBeVisible();
});

test('an operator is refused the shift-calendar screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'op');
  await page.goto('/analytics/breakdowns?screen=shift-kpis');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('[data-heat="matrix"]')).toHaveCount(0);
});
