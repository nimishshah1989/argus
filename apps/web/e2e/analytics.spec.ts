import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { signIn } from './fixtures.js';

/** A fake id: the figure drills to it and the drill reply names the same machine row. */
const MACHINE_ID = '10000000-0000-4000-8000-000000000001';

/** One ready dashboard figure that drills to the machine row below. */
const FIGURES_REPLY = {
  asOf: '2026-11-17',
  profile: {},
  rows: { machines: 1, moves: 0, tickets: 0, tasks: 0, reports: 0, people: 0 },
  figures: [
    {
      key: 'dashboard.total-machines',
      screen: 'dashboard',
      owner: 38,
      status: 'ready',
      value: 12,
      drill: { type: 'machine', ids: [MACHINE_ID] },
    },
  ],
};

/** The machine row the figure drilled to, in the engine's plain shape. */
const DRILL_ROW = {
  id: MACHINE_ID,
  code: 'M-1',
  segment: 'CNC',
  category: 'CNC',
  cell: 'Cell 4',
  location: null,
  make: null,
  model: null,
  serial: null,
  controller: null,
  controllerModel: null,
  controllerSerial: null,
  year: null,
  purchasedOn: null,
  powerKw: null,
  capacityKva: null,
  assetCode: null,
  status: 'active',
  criticality: 'A',
  excludedFromProduction: false,
  metadata: {},
};

type Figure = FiguresReply['figures'][number];

/** The unit each Today number prints after its value; the six fleet counts have none. */
const UNIT_AFTER: Record<string, string> = {
  'dashboard.total-downtime-hours': ' hrs',
  'dashboard.pm-hours': ' hrs',
  'dashboard.no-downtime-hours': ' hrs',
  'dashboard.plant-events': ' hrs',
  'dashboard.fleet-availability': '%',
  'dashboard.plant-bd-pct': '%',
  'dashboard.avg-complaints-per-day': ' /day',
  'dashboard.avg-bd-hours-per-day': ' hrs/day',
  'dashboard.avg-bd-hours-per-machine': ' hrs/machine',
};

/**
 * The text a tile prints for a scalar value: a number's exact face, a string as it came, yes/no. Null when the
 * value is not a scalar: a ready null prints "—" and an object renders its own content, both asserted structurally.
 */
const valueText = (figure: Figure): string | null => {
  const value = figure.value;
  if (typeof value === 'number') {
    // Written out here, not taken from the product's formatter: Indian grouping, the engine's own places (an hours
    // figure at least one), and the unit after it, e.g. 1,343 and 2,145.5 hrs and 94.37%.
    const places = Math.min(2, (String(value).split('.')[1] ?? '').length);
    const hours = UNIT_AFTER[figure.key]?.startsWith(' hrs') === true;
    const number = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: hours ? Math.max(1, places) : places,
      maximumFractionDigits: hours ? Math.max(1, places) : places,
    }).format(value);
    return `${number}${UNIT_AFTER[figure.key] ?? ''}`;
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return null;
};

/** One dashboard figure's tile, found by the registry key the screen stamps on it. */
const tile = (page: Page, key: string) => page.locator(`[data-figure="${key}"]`);

/**
 * The three chart/table payloads are pinned here: the e2e seed holds no history rows, so the live engine answers
 * the bubble and the timeline with a null value and the costliest table with no rows. Everything else stays live.
 */
const OBJECT_VALUES: Record<string, unknown> = {
  'dashboard.bubble-chart': {
    axes: { x: 'BD Hours (machine total)', y: 'Number of Breakdowns' },
    datasets: [
      {
        label: 'Machines',
        data: [{ x: 12, y: 3, r: 16, id: MACHINE_ID, model: 'CNC-1', age: '2 yrs', mttr: 4 }],
      },
    ],
  },
  'dashboard.expansion-timeline': {
    axes: { x: '', y: '', y1: '' },
    labels: [2024, 2025],
    datasets: [
      { label: 'VC', data: [1, 0] },
      { label: 'Cumulative Fleet Size', data: [1, 2] },
    ],
  },
  'dashboard.costliest-problems': {
    rows: [{ problem: 'Spindle alarm', hours: 4.5, share: 75, breakdowns: 3 }],
    totalHours: 6,
  },
};

/** The live figures reply with the three object payloads pinned, so rendering does not depend on the seed. */
async function pinObjectFigures(page: Page): Promise<void> {
  await page.route('**/api/v1/analytics/figures', async (route) => {
    const response = await route.fetch();
    const reply = (await response.json()) as FiguresReply;
    const figures = reply.figures.map((figure) => {
      const value = OBJECT_VALUES[figure.key];
      return value === undefined
        ? figure
        : { ...figure, status: 'ready' as const, value: value as Figure['value'] };
    });
    await route.fulfill({ response, json: { ...reply, figures } });
  });
}

/**
 * One ready figure's tile: a scalar prints its exact face, a ready null prints "—", a mapped object draws its
 * content, and an object with no renderer says "Only numbers so far". The word "Ready" is never claimed.
 */
async function expectReadyFigure(page: Page, figure: Figure): Promise<void> {
  const found = tile(page, figure.key);
  const value = figure.value;
  if (value === null) {
    await expect(found).toContainText('—');
    return;
  }
  const text = valueText(figure);
  if (text !== null) {
    await expect(found).toContainText(text);
    return;
  }
  switch (figure.key) {
    case 'dashboard.bubble-chart':
    case 'dashboard.expansion-timeline':
      await expect(found.locator('[data-testid="chart"]')).toHaveAttribute(
        'data-chart-state',
        'ready',
      );
      return;
    case 'dashboard.breakdown-free': {
      const counts = value as { runningClean: number; inService: number };
      await expect(found).toContainText(`${counts.runningClean} of ${counts.inService}`);
      return;
    }
    case 'dashboard.costliest-problems': {
      const rows = (value as { rows: { problem: string }[] }).rows;
      if (rows[0] !== undefined) await expect(found).toContainText(rows[0].problem);
      return;
    }
    case 'data-checklist':
      return;
    default:
      await expect(found).toContainText('Only numbers so far');
  }
}

/**
 * The first Dashboard figure the live reply leaves uncomputed: its tile must say so, whatever this packet
 * has computed. Null only when every Dashboard figure is ready.
 */
const firstHeld = (reply: FiguresReply) =>
  reply.figures.find((figure) => figure.screen === 'dashboard' && figure.status !== 'ready');

/**
 * The shell's menu (86a): six sections and the Guide. On a phone it is a drawer behind the Menu button; the data
 * checklist is a tab of Today, not a menu entry.
 */
async function expectShellMenu(page: Page, wide: boolean) {
  if (!wide) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const menu = page.getByRole('navigation', { name: 'Analytics', exact: true });
  for (const name of [
    'Today',
    'Machines',
    'Problems',
    'Reliability & forecast',
    'People & money',
    'Reports',
    'Guide',
  ])
    await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Screens in Today', exact: true })
      .getByRole('link', { name: 'Data checklist', exact: true }),
  ).toBeVisible();
  return menu;
}

/**
 * Ticket 37b: the analytics face, its Guide entry and the profile screen. The computable Dashboard
 * figures are ready and the held ones stay honestly "Not computed yet". The drill test stubs both analytics
 * replies, so it never waits for the live engine.
 */
test('a head opens the analytics face, its Guide, and edits the plant profile', async ({
  page,
}, testInfo) => {
  const wide = testInfo.project.name === 'chromium';
  if (wide) await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'head');

  // Packet 38.3: the head's home is Today, and the desk still offers the face on its own menu.
  await expect(page).toHaveURL(/\/analytics\/today$/);
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await page.goto('/desk');
  if (wide) await expect(page.getByRole('link', { name: 'Analytics', exact: true })).toBeVisible();

  const response = page.waitForResponse(
    (reply) => reply.url().includes('/api/v1/analytics/figures') && reply.status() === 200,
  );
  await page.goto('/analytics');
  await expect(page).toHaveURL(/\/analytics\/today$/);
  const reply = (await (await response).json()) as FiguresReply;

  const menu = await expectShellMenu(page, wide);

  // The honest state: a held figure claims no value it does not have.
  const held = firstHeld(reply);
  if (held) await expect(tile(page, held.key)).toContainText('Not computed yet');
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();

  // The Guide lists the screens and figures with their labels.
  await menu.getByRole('link', { name: 'Guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Guide', exact: true })).toBeVisible();
  await expect(page.getByText('Total machines', { exact: true }).first()).toBeVisible();

  // Settings → the analytics profile: one number saves on the real route and survives a reload.
  await page.goto('/settings/analytics-profile');
  await expect(page.getByRole('heading', { name: 'Analytics profile', exact: true })).toBeVisible();
  // One row, so there is nothing to add: the screen ships no Add button and no add sheet.
  await expect(page.getByRole('button', { name: 'Add', exact: true })).toHaveCount(0);
  await page
    .getByRole('button', { name: /^Edit / })
    .first()
    .click();
  const form = page.getByRole('form', { name: /^Edit / });
  await form.getByLabel('Production hours per day', { exact: true }).fill('21');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form).toBeHidden();

  await page.reload();
  await page
    .getByRole('button', { name: /^Edit / })
    .first()
    .click();
  await expect(
    page
      .getByRole('form', { name: /^Edit / })
      .getByLabel('Production hours per day', { exact: true }),
  ).toHaveValue('21');
});

/**
 * Packet 38.3's journey: a head signs in on Today, sees the values the live API returns, opens one
 * drill's rows, sees a held figure stay honest, and opens the data checklist.
 */
test('a head lands on Today with the live figures, a drill and the data checklist', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await pinObjectFigures(page);
  const response = page.waitForResponse(
    (reply) => reply.url().includes('/api/v1/analytics/figures') && reply.status() === 200,
  );
  await signIn(page, 'head');
  await expect(page).toHaveURL(/\/analytics\/today$/);
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  const reply = (await (await response).json()) as FiguresReply;

  // Every Dashboard figure the live API returns has a tile. A scalar prints the exact value the API returned; a
  // ready null prints "—"; an object draws its mapped content (the two charts, the breakdown-free sentence, the
  // costliest table) and never claims the word "Ready".
  const dashboard = reply.figures.filter((figure) => figure.screen === 'dashboard');
  const ready = dashboard.filter((figure) => figure.status === 'ready');
  expect(ready.length).toBeGreaterThan(0);
  for (const figure of dashboard) await expect(tile(page, figure.key)).toBeVisible();
  for (const figure of ready) await expectReadyFigure(page, figure);
  await expect(page.locator('[data-figure]').filter({ hasText: 'Ready' })).toHaveCount(0);

  // The strip above the tiles is built from the existing /state, with no new endpoint.
  await expect(page.getByRole('heading', { name: 'What needs you now' })).toBeVisible();

  // One drill opens the rows behind its figure, in the table the face already has.
  const drilled = ready.find((figure) => figure.drill.ids.length > 0);
  expect(drilled).toBeTruthy();
  await tile(page, drilled!.key)
    .getByRole('link', { name: /^See the rows/ })
    .click();
  await expect(page).toHaveURL(/\/analytics\/today\?drill=/);
  const drill = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'The rows behind this figure' }) });
  const table = drill.getByRole('table');
  await expect(table).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(drilled!.drill.ids.length + 1);

  // A held figure never invents a number.
  const held = firstHeld(reply);
  if (held) await expect(tile(page, held.key)).toContainText('Not computed yet');

  // The data checklist has its own route, a tab of Today. Its tile lists the open items it computes,
  // grouped and counted, and never claims a "Ready" it does not have.
  const tabs = page.getByRole('navigation', { name: 'Screens in Today', exact: true });
  await tabs.getByRole('link', { name: 'Data checklist', exact: true }).click();
  await expect(page).toHaveURL(/\/analytics\/today\/checklist$/);
  await expect(page.getByRole('heading', { name: 'Data checklist', exact: true })).toBeVisible();
  const checklistTile = tile(page, 'data-checklist');
  await expect(checklistTile).not.toContainText('Ready');
  await expect(checklistTile).not.toContainText('Not computed yet');
  const checklist = reply.figures.find((figure) => figure.key === 'data-checklist');
  const items =
    checklist !== undefined && typeof checklist.value === 'object' && checklist.value !== null
      ? (checklist.value as { items: { plain: string }[] }).items
      : [];
  await expect(checklistTile.locator('li')).toHaveCount(items.length);
  if (items[0] !== undefined) await expect(checklistTile).toContainText(items[0].plain);
});

/**
 * The honesty gate on the strip: a head lands straight on Today, so a slow `/state` must not read as an
 * all-clear. The reply is held for a moment to catch the strip before its data lands.
 */
test('the needs-now strip says it is loading until /state arrives, never a false all-clear', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/v1/state', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.continue();
  });
  await signIn(page, 'head');

  const strip = page.getByRole('region', { name: 'What needs you now' });
  await expect(strip.getByText('Loading…', { exact: true })).toBeVisible();
  await expect(strip.getByText('Nothing needs you now.', { exact: true })).toHaveCount(0);
  // The count line would also claim nothing before the reply lands.
  await expect(strip.getByText(/clocks breached/)).toHaveCount(0);

  // Once /state lands, the strip says what it knows.
  await expect(strip.getByText(/clocks breached/)).toBeVisible({ timeout: 15_000 });
});

test('a ready figure opens the table of rows behind it', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'head');

  // Stub the two engine replies: one ready dashboard figure that drills to one machine row.
  await page.route('**/api/v1/analytics/figures', (route) =>
    route.fulfill({ json: FIGURES_REPLY }),
  );
  await page.route('**/api/v1/analytics/drill?*', (route) =>
    route.fulfill({ json: { type: 'machine', rows: [DRILL_ROW] } }),
  );

  await page.goto('/analytics/today');

  // A ready figure prints its value and offers the rows it came from.
  await expect(tile(page, 'dashboard.total-machines')).toContainText('Total machines');
  await expect(tile(page, 'dashboard.total-machines')).toContainText('12');
  await tile(page, 'dashboard.total-machines')
    .getByRole('link', { name: /^See the rows/ })
    .click();

  // The drill table is the plain list of what identifies each row.
  await expect(page).toHaveURL(/\/analytics\/today\?drill=machine%3A/);
  await expect(page.getByRole('heading', { name: 'The rows behind this figure' })).toBeVisible();
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  await expect(table.getByRole('cell', { name: 'M-1', exact: true })).toBeVisible();
  await expect(table.getByRole('cell', { name: 'Cell 4', exact: true })).toBeVisible();
});

test('an operator lands on My complaints and has no analytics entry', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'op');

  // Row 38: the operator's home is unchanged — My complaints, not the face.
  await expect(page).toHaveURL(/\/floor\/mine$/);
  await expect(page.getByRole('heading', { name: 'My complaints', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Analytics', exact: true })).toHaveCount(0);

  await page.goto('/settings/analytics-profile');
  await expect(
    page.getByRole('heading', { name: 'No settings access', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0);
});
