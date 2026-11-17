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
  controller: null,
  year: null,
  purchasedOn: null,
  powerKw: null,
  capacityKva: null,
  assetCode: null,
  status: 'active',
  criticality: 'A',
  metadata: {},
};

type Figure = FiguresReply['figures'][number];

/** The face prints a number the way the app does: grouped, hours with at least one decimal. */
const HOUR_FIGURES = new Set([
  'dashboard.total-downtime-hours',
  'dashboard.pm-hours',
  'dashboard.no-downtime-hours',
  'dashboard.avg-bd-hours-per-day',
  'dashboard.avg-bd-hours-per-machine',
]);
const valueText = (figure: Figure): string =>
  typeof figure.value === 'number'
    ? new Intl.NumberFormat('en-GB', {
        minimumFractionDigits: HOUR_FIGURES.has(figure.key) ? 1 : 0,
        maximumFractionDigits: 2,
      }).format(figure.value)
    : String(figure.value);

/** One dashboard figure's tile, found by the registry key the screen stamps on it. */
const tile = (page: Page, key: string) => page.locator(`[data-figure="${key}"]`);

/**
 * Ticket 37b: the analytics face, its Guide entry and the profile screen. The eleven computable Dashboard
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

  await page.goto('/analytics');
  await expect(page).toHaveURL(/\/analytics\/today$/);

  const menu = page.getByRole('navigation', { name: 'Analytics', exact: true });
  for (const name of [
    'Today',
    'Machines',
    'Breakdowns',
    'Forecast & scorecard',
    'PM',
    'Cost',
    'Reports',
    'Guide',
    'Data checklist',
  ])
    await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();

  // The honest state: a held figure claims no value it does not have.
  await expect(tile(page, 'dashboard.fleet-availability')).toContainText('Not computed yet');
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
 * Packet 38.3's journey: a head signs in on Today, sees the eleven values the live API returns, opens one
 * drill's rows, sees a held figure stay honest, and opens the data checklist.
 */
test('a head lands on Today with the live figures, a drill and the data checklist', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = page.waitForResponse(
    (reply) => reply.url().includes('/api/v1/analytics/figures') && reply.status() === 200,
  );
  await signIn(page, 'head');
  await expect(page).toHaveURL(/\/analytics\/today$/);
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  const reply = (await (await response).json()) as FiguresReply;

  // The eleven computable Dashboard figures: every tile prints the value the live API returned.
  const ready = reply.figures.filter(
    (figure) => figure.screen === 'dashboard' && figure.status === 'ready',
  );
  expect(ready).toHaveLength(11);
  for (const figure of ready) await expect(tile(page, figure.key)).toContainText(valueText(figure));

  // The strip above the tiles is built from the existing /state, with no new endpoint.
  await expect(page.getByRole('heading', { name: 'What needs you now' })).toBeVisible();

  // One drill opens the rows behind its figure, in the table the face already has.
  const drilled = ready.find((figure) => figure.drill.ids.length > 0);
  expect(drilled).toBeTruthy();
  await tile(page, drilled!.key).getByRole('link', { name: 'See the rows', exact: true }).click();
  await expect(page).toHaveURL(/\/analytics\/today\?drill=/);
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(drilled!.drill.ids.length + 1);

  // A held figure never invents a number.
  await expect(tile(page, 'dashboard.fleet-availability')).toContainText('Not computed yet');

  // The data checklist has its own route, at the foot of the menu, and stays honest until 38.2 computes it.
  const menu = page.getByRole('navigation', { name: 'Analytics', exact: true });
  await menu.getByRole('link', { name: 'Data checklist', exact: true }).click();
  await expect(page).toHaveURL(/\/analytics\/today\/checklist$/);
  await expect(page.getByRole('heading', { name: 'Data checklist', exact: true })).toBeVisible();
  await expect(page.getByText('Not computed yet', { exact: true })).toBeVisible();
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
    .getByRole('link', { name: 'See the rows', exact: true })
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
