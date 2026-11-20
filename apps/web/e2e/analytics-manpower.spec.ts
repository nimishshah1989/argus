import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { getJson, commandViaApi } from './fixtures-actions.js';
import { MACHINES, apiLogin, floorMachine, raiseTicketViaApi, signIn } from './fixtures.js';

/**
 * 41e-1: the A4 manpower and A5 energy screens. A head opens A4, sees the key's three KPIs, five tables and
 * chart, sorts the Manpower table by a numeric column and back (mouse then keyboard), toggles the Specialization
 * card to the honest code view and back, and drills to the ticket rows. Then A5: its two heat grids and the
 * per-machine average grid, every clickable tile filtering the figure's machine drill reply by its cell or
 * location, and a machine row opening that machine's page. The figures reply is stubbed (the established seam),
 * so the journey proves the screens; the drill rows are real.
 */

type Figure = FiguresReply['figures'][number];
type Ticket = { id: string; ref: string };

const AS_OF = '2026-11-11';

const A4_KPIS = [
  { label: 'Total Breakdowns', value: '1279', sub: 'PM excluded' },
  { label: 'Total BD Hours', value: '3,060.1', sub: 'across all team' },
  { label: 'Team Members Tracked', value: '14', sub: 'incl. vendors' },
];

const A4_TABLE_TITLES = [
  'Manpower Table',
  'Preventive Maintenance (PM) — Month-on-Month by Team Member',
  'Specialization',
  'Month-on-Month — # Breakdowns Handled',
  'Month-on-Month — BD Hours Handled',
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MANPOWER_ROWS = [
  ['Person 11', 'Team', '197', '469.40', '2.38', '13', '26.82', '210', '15.40%'],
  ['Person 79', 'Team', '149', '403.67', '2.71', '5', '2.90', '154', '11.65%'],
  ['Imptex Team', 'Vendor', '5', '20.50', '4.10', '0', '0.00', '5', '0.39%'],
];

const A4_CHART = {
  id: 'ch-a4-count',
  type: 'bar',
  axes: { x: '', y: '' },
  tickLabels: { x: [], y: [] },
  labels: ['Person 11', 'Person 79', 'Imptex Team'],
  datasets: [{ label: '# Breakdowns', data: [197, 149, 5] }],
};

/** The key's seven location buckets; the seeded plant records no location, so a location tile drills to no rows. */
const A5_LOCATIONS = ['434', '435/4', '445', '486', '841-A', '841-B', '381'];

const A5_CELLS = [
  { key: '1', codes: ['VC-1', 'VC-2'] },
  { key: '2', codes: ['VC-3', 'VC-4'] },
  { key: '3', codes: ['VC-5', 'VC-6'] },
  { key: '4', codes: ['VC-7', 'VC-8'] },
  { key: '5', codes: ['VC-9', 'VC-10'] },
  { key: '6', codes: [floorMachine(1, 'chromium').code, floorMachine(2, 'chromium').code] },
];

const A5_MACHINE_IDS = [
  ...MACHINES.map((machine) => machine.id),
  floorMachine(1, 'chromium').id,
  floorMachine(2, 'chromium').id,
];

let tickets: { first: Ticket; second: Ticket };

test.beforeAll(async () => {
  const token = await apiLogin('head');
  const me = await getJson<{ user: { actingPersonId: string } }>(token, '/api/v1/auth/me');
  const first = await raiseTicketViaApi(token, null, 'A4: ATC trouble Machine Stop');
  const second = await raiseTicketViaApi(token, null, 'A4: phase failure');
  for (const ticket of [first, second])
    await commandViaApi(token, ticket.id, 'cancel', {
      personId: me.user.actingPersonId,
      reason: 'A4 manpower spec',
    });
  tickets = { first, second };
});

function a4ManpowerTable() {
  return {
    title: A4_TABLE_TITLES[0],
    header: [
      'Name',
      'Type',
      '# BD (Done By)',
      'BD Hours (Done)',
      'Avg MTTR',
      '# BD (Supported)',
      'Hours (Supported)',
      'Total Involvement',
      '% of Total',
    ],
    rows: MANPOWER_ROWS,
    rowCount: MANPOWER_ROWS.length,
  };
}

function a4PmTable() {
  return {
    title: A4_TABLE_TITLES[1],
    header: ['Name', ...MONTHS, 'Total'],
    rows: [
      ['Person 51', ...MONTHS.map(() => '—'), '15'],
      [...MONTHS.map(() => '—'), '124.8'],
    ],
    rowCount: 2,
  };
}

function a4SpecializationTable() {
  return {
    title: A4_TABLE_TITLES[2],
    header: ['Name', 'Turning Cen…', 'Vertical Ma…', 'WaterJet CNC'],
    rows: [
      ['Person 79', '12', '3', '—'],
      ['Person 49', '4', '—', '1'],
    ],
    rowCount: 2,
  };
}

function a4MomTable(title: string, totals: [string, string]) {
  const row = (name: string, total: string) => [name, ...MONTHS.map(() => '—'), total];
  return {
    title,
    header: ['Name', ...MONTHS, 'Total'],
    rows: [row('Person 11', totals[0]), row('Person 79', totals[1])],
    rowCount: 2,
  };
}

function a4Figure(): Figure {
  return {
    key: 'a4-manpower',
    screen: 'a4-manpower',
    owner: 41,
    status: 'ready',
    value: {
      screen: 'a4-manpower',
      asOf: AS_OF,
      pages: [
        {
          page: 'a4',
          title: 'Manpower Efficiency',
          kpis: A4_KPIS,
          tables: [
            a4ManpowerTable(),
            a4PmTable(),
            a4SpecializationTable(),
            a4MomTable(A4_TABLE_TITLES[3] ?? 'Month-on-Month — # Breakdowns Handled', ['14', '11']),
            a4MomTable(A4_TABLE_TITLES[4] ?? 'Month-on-Month — BD Hours Handled', [
              '196.3',
              '107.3',
            ]),
          ],
          charts: [A4_CHART],
        },
      ],
    },
    drill: { type: 'ticket', ids: [tickets.first.id, tickets.second.id] },
  };
}

/** A5 with the real seeded machines' cells: every cell tile drills to machines the server can return. */
function a5Figure(): Figure {
  const byCell = A5_CELLS.map((cell, index) => {
    const connected = 100 + index * 50;
    const codes = new Set(cell.codes);
    const ids = MACHINES.filter((machine) => codes.has(machine.code)).map((machine) => machine.id);
    for (const slot of [1, 2]) {
      const floor = floorMachine(slot, 'chromium');
      if (codes.has(floor.code)) ids.push(floor.id);
    }
    return {
      key: cell.key,
      machines: cell.codes.length,
      totalKva: connected,
      avgKva: connected / cell.codes.length,
      runningKva: connected * 0.2,
      avgRunningKva: (connected * 0.2) / cell.codes.length,
      machineIds: ids,
    };
  });
  const byLocation = A5_LOCATIONS.map((key) => ({
    key,
    machines: 1,
    totalKva: 10,
    avgKva: 10,
    runningKva: 2,
    avgRunningKva: 2,
    machineIds: [],
  }));
  return {
    key: 'a5-energy',
    screen: 'a5-energy',
    owner: 41,
    status: 'ready',
    value: {
      screen: 'a5-energy',
      asOf: AS_OF,
      pages: [{ page: 'a5', title: 'Energy Heatmap', kpis: [], tables: [], charts: [] }],
      extra: { byCell, byLocation, effFactorPct: 20 },
    },
    drill: { type: 'machine', ids: A5_MACHINE_IDS },
  };
}

async function stubFigures(page: Page): Promise<void> {
  const reply: FiguresReply = {
    asOf: AS_OF,
    profile: {} as FiguresReply['profile'],
    excludedMachines: 0,
    rows: { machines: 12, moves: 0, tickets: 2, tasks: 0, reports: 5, people: 4 },
    figures: [a4Figure(), a5Figure()],
  };
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: reply }));
}

async function firstManpowerName(page: Page): Promise<string> {
  const table = page.getByRole('table', { name: 'Manpower Table', exact: true });
  return (await table.getByRole('row').nth(1).getByRole('cell').first().innerText()).trim();
}

/** A4: the key page, the sortable Manpower table (mouse then keyboard), the toggle, the drill. */
async function openA4(page: Page): Promise<void> {
  await page.goto('/analytics/breakdowns?screen=a4-manpower');
  const nav = page.getByRole('navigation', { name: 'Breakdowns screens', exact: true });
  await expect(nav.getByRole('link', { name: 'A4 manpower', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(
    page.getByRole('heading', { name: 'Manpower Efficiency', exact: true }),
  ).toBeVisible();
  for (const kpi of A4_KPIS) {
    await expect(page.getByText(kpi.label, { exact: true })).toBeVisible();
    await expect(page.getByText(kpi.value, { exact: true }).first()).toBeVisible();
  }
  for (const title of A4_TABLE_TITLES)
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '469.40', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '15.40%', exact: true })).toBeVisible();
  const charts = page.getByTestId('chart');
  await expect(charts).toHaveCount(1);
  await expect(charts).toHaveAttribute('data-chart-state', 'ready');
  await expect(page.getByText('Breakdowns handled — Done By', { exact: true })).toBeVisible();
}

async function sortManpower(page: Page): Promise<void> {
  const table = page.getByRole('table', { name: 'Manpower Table', exact: true });
  const header = table.getByRole('columnheader', { name: '# BD (Done By)', exact: true });
  await expect(header).toHaveAttribute('aria-sort', 'none');
  expect(await firstManpowerName(page)).toBe('Person 11');
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  expect(await firstManpowerName(page)).toBe('Imptex Team');
  await header.getByRole('button').press('Enter');
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  expect(await firstManpowerName(page)).toBe('Person 11');
}

async function toggleSpecialization(page: Page): Promise<void> {
  const toggle = page.getByRole('group', { name: 'Specialization view', exact: true });
  await expect(toggle.getByRole('button', { name: 'By Category', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('columnheader', { name: 'Turning Cen…', exact: true })).toBeVisible();
  await toggle.getByRole('button', { name: 'By Fault Code', exact: true }).click();
  await expect(page.getByText('Not computed yet', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Turning Cen…', exact: true })).toHaveCount(
    0,
  );
  await toggle.getByRole('button', { name: 'By Category', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Person 79', exact: true }).first()).toBeVisible();
}

/** A5: both heat maps, the average map, every cell tile's drawer and every location tile with no machines behind it. */
async function openA5(page: Page): Promise<void> {
  await page.goto('/analytics/machines?screen=a5-energy');
  const tabs = page.getByRole('group', { name: 'Machines screens', exact: true });
  await expect(
    tabs.getByRole('button', { name: 'A5 energy heatmap', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Energy Heatmap' })).toBeVisible();
  for (const title of [
    'Load by Cell — Connected & Running',
    'Load by Location — Connected & Running',
    'Avg Connected KVA per Machine — by Cell',
  ])
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('[data-tile^="cell:"]')).toHaveCount(A5_CELLS.length);
  await expect(page.locator('[data-tile^="location:"]')).toHaveCount(A5_LOCATIONS.length);
  await expect(page.locator('[data-tile^="machine:"]')).toHaveCount(A5_CELLS.length);
  const first = page.locator('[data-tile="cell:1"]');
  await expect(first).toContainText('Connected KVA');
  await expect(first).toContainText('Running: 20.0 KVA');
  // A tile's tint is never the only sign: it prints its figure and is named by it for a screen reader.
  await expect(first).toHaveAttribute('data-level', /^[1-5]$/);
  await expect(first).toHaveAttribute('aria-label', /^Cell 1: 100\.0 Connected KVA/);
}

async function drillEveryCell(page: Page): Promise<void> {
  const drawer = page.locator('aside.v2-drawer');
  for (const cell of A5_CELLS) {
    await page.locator(`[data-tile="cell:${cell.key}"]`).click();
    await expect(page).toHaveURL(/[?&]drawer=figure:a5-energy%3Acell%3A/);
    await expect(
      drawer.getByText(`Machine-wise Load — Cell ${cell.key}`, { exact: true }).first(),
    ).toBeVisible();
    for (const code of cell.codes)
      await expect(drawer.getByRole('button', { name: code, exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).not.toHaveURL(/drawer=/);
  }
}

/** A location the plant recorded no machines for has no rows to open: its tile prints its load and is not a button. */
async function everyLocationHasNoRows(page: Page): Promise<void> {
  for (const key of A5_LOCATIONS) {
    await expect(page.locator(`[data-tile="location:${key}"]`)).toBeVisible();
    await expect(page.locator(`button[data-tile="location:${key}"]`)).toHaveCount(0);
  }
}

test('a head opens A4, sorts and toggles it, then A5 and drills every tile and a machine row', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');

  await openA4(page);
  await sortManpower(page);
  await toggleSpecialization(page);
  await page.getByRole('link', { name: 'See the rows', exact: true }).click();
  await expect(page).toHaveURL(/drill=ticket%3A/);
  await expect(
    page.getByRole('heading', { name: 'The rows behind this figure', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: tickets.first.ref, exact: true })).toBeVisible();

  await openA5(page);
  await drillEveryCell(page);
  await everyLocationHasNoRows(page);

  // A machine in a tile's rows opens its own drawer on top of them; Back returns to the rows.
  await page.locator('[data-tile="cell:1"]').click();
  const drawer = page.locator('aside.v2-drawer');
  await drawer.getByRole('button', { name: 'VC-1', exact: true }).click();
  await expect(page).toHaveURL(/[?&]drawer=machine:VC-1/);

  // An old v1 address with the figure's rows in it opens those rows, and the old parameter goes.
  await page.goto(
    `/analytics/machines?screen=a5-energy&drill=${encodeURIComponent(`machine:${A5_MACHINE_IDS.join(',')}`)}`,
  );
  await expect(page).toHaveURL(/[?&]drawer=figure:a5-energy$/);
  await expect(page).not.toHaveURL(/drill=/);
  await expect(
    page.locator('aside.v2-drawer').getByText(new RegExp(`of ${A5_MACHINE_IDS.length}$`)),
  ).toBeVisible();

  // The page action opens every machine the figure counted.
  await page.goto('/analytics/machines?screen=a5-energy');
  await page.getByRole('button', { name: /Show the rows behind A5 energy heatmap/ }).click();
  await expect(page).toHaveURL(/[?&]drawer=figure:a5-energy$/);
  await expect(
    page.locator('aside.v2-drawer').getByText(new RegExp(`of ${A5_MACHINE_IDS.length}$`)),
  ).toBeVisible();
});
