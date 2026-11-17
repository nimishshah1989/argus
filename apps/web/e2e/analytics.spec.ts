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

/**
 * Ticket 37b: the analytics face, its Guide entry and the profile screen. No engine is registered yet
 * (COMPUTERS is empty), so every figure is honestly "Not computed yet". The drill test stubs both analytics
 * replies, so it never waits for a live engine or for sibling packet 37a's route.
 */
test('a head opens the analytics face, its Guide, and edits the plant profile', async ({
  page,
}, testInfo) => {
  const wide = testInfo.project.name === 'chromium';
  if (wide) await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'head');

  // The desk offers the face to a head: the desktop left menu, where the desk's own destinations live.
  if (wide) await expect(page.getByRole('link', { name: 'Analytics', exact: true })).toBeVisible();

  await page.goto('/analytics');
  await expect(page).toHaveURL(/\/analytics\/today$/);
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();

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
  ])
    await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();

  // The honest state: the registry's figures are listed, and none claims a value it does not have.
  await expect(page.getByText('Not computed yet').first()).toBeVisible();
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
  await expect(page.getByText('Total machines', { exact: true })).toBeVisible();
  await expect(page.getByText('12', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'See the rows', exact: true }).click();

  // The drill table is the plain list of what identifies each row.
  await expect(page).toHaveURL(/\/analytics\/today\?drill=machine%3A/);
  await expect(page.getByRole('heading', { name: 'The rows behind this figure' })).toBeVisible();
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  await expect(table.getByRole('cell', { name: 'M-1', exact: true })).toBeVisible();
  await expect(table.getByRole('cell', { name: 'Cell 4', exact: true })).toBeVisible();
});

test('an operator gets no analytics entry and no analytics profile', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'op');
  await expect(page.getByRole('link', { name: 'Analytics', exact: true })).toHaveCount(0);

  await page.goto('/settings/analytics-profile');
  await expect(
    page.getByRole('heading', { name: 'No settings access', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0);
});
