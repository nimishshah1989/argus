import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { MACHINES, apiFetch, apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';

interface OpenTicket {
  id: string;
  machineId: string | null;
  ref: string;
  machineSnapshot: Record<string, unknown> | null;
}

/** VC-7/VC-8 are board-only machines; tags and Settings use different fixtures. */
function boardMachine(projectName: string) {
  const machine = MACHINES[projectName === 'phone' ? 7 : 6];
  if (!machine) throw new Error(`No board machine fixture for ${projectName}`);
  return machine;
}

async function openTicketFor(token: string, machineId: string): Promise<OpenTicket | null> {
  const res = await apiFetch('/api/v1/state', {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as { open: OpenTicket[] };
  return body.open.find((ticket) => ticket.machineId === machineId) ?? null;
}

/** The machine's breakdown, raised now if it has none (a retry finds the first try's ticket). */
async function breakdownOn(token: string, machineId: string, code: string): Promise<OpenTicket> {
  const existing = await openTicketFor(token, machineId);
  if (existing) return existing;
  await raiseTicketViaApi(token, machineId, `Spindle alarm on ${code}`);
  return (await openTicketFor(token, machineId))!;
}

async function openBoard(page: Page, kiosk: boolean): Promise<void> {
  await page.goto(kiosk ? '/desk/board?kiosk=1' : '/desk/board');
  await expect(page.getByRole('heading', { name: 'Live board' })).toBeAttached();
}

const column = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

/**
 * SPEC 1.7 and the board approved on 14 Nov: a stopped machine shows in the column of who owns its next
 * step, with its age, and the pulse counts it. Other specs raise tickets on the other machines, so the
 * counts are lower bounds while the machine's own tile is matched exactly.
 */
test('a breakdown nobody has started shows its machine and age, and the pulse counts it', async ({
  page,
}, testInfo) => {
  const machine = boardMachine(testInfo.project.name);
  const token = await apiLogin('asha');
  await breakdownOn(token, machine.id, machine.code);

  await signIn(page, 'asha');
  await openBoard(page, false);

  const tile = column(page, 'Nobody has started')
    .getByTestId('tile')
    .filter({ hasText: machine.code });
  await expect(tile).toHaveCount(1);
  await expect(tile).toContainText(machine.cell);
  await expect(tile).toContainText(/\d+ (min|h|d)/);
  expect(Number(await page.getByTestId('count-stopped').textContent())).toBeGreaterThanOrEqual(1);
  await expect(page.getByText(/of \d+ machines/)).toBeVisible();
});

test('the TV is dark, has no navigation, and shows the three oldest stops of a column', async ({
  page,
}, testInfo) => {
  const machine = boardMachine(testInfo.project.name);
  const token = await apiLogin('asha');
  const base = await breakdownOn(token, machine.id, machine.code);
  const fakes = MACHINES.slice(0, 5).map((m, i) => ({
    ...base,
    id: `fake-${i}`,
    ref: `BD-F${i}`,
    status: 'open',
    machineId: m.id,
    machineSnapshot: { ...base.machineSnapshot, id: m.id, code: m.code },
    machineRunningAt: null,
    machineStoppedAt: null,
    figures: null,
    reportedAt: new Date(Date.now() - (i + 1) * 3_600_000).toISOString(),
  }));
  const auth = { headers: { authorization: `Bearer ${token}` } };
  const state = (await (await apiFetch('/api/v1/state', auth)).json()) as Record<string, unknown>;
  await page.route('**/api/v1/state', (route) =>
    route.fulfill({ json: { ...state, now: new Date().toISOString(), open: fakes } }),
  );

  await signIn(page, 'asha');
  await openBoard(page, true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('link')).toHaveCount(0);
  const notStarted = column(page, 'Nobody has started');
  await expect(notStarted.getByTestId('tile')).toHaveText([/VC-5/, /VC-4/, /VC-3/]);
  await expect(notStarted).toContainText('and 2 more');

  await openBoard(page, false);
  await expect(notStarted.getByTestId('tile')).toHaveCount(5);
  await expect(notStarted).not.toContainText('more');
});

test('sits in the Shell outside kiosk mode, and a wide screen opens the TV view', async ({
  page,
}, testInfo) => {
  await signIn(page, 'asha');
  await openBoard(page, false);
  // ADR 0055/0056 (S30): the rail's Desk link, the Desk tabs with Live pressed, and Report a problem.
  // The phone's closed menu keeps the rail out of the accessibility tree, so find it by address.
  await expect(page.locator('.v2-rail a[href="/desk"]')).toBeAttached();
  await expect(page.getByRole('button', { name: 'Live', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('link', { name: 'Report a problem' })).toBeVisible();
  const tvView = page.getByRole('link', { name: 'Open TV view' });
  if (testInfo.project.name !== 'chromium') return expect(tvView).toBeHidden();
  await tvView.click();
  await expect(page).toHaveURL(/\/desk\/board\?kiosk=1$/);
  await expect(page.getByRole('link')).toHaveCount(0);
});

/**
 * S30 (wireframe approved 25 Nov): a stop row opens its ticket (S29) in the side panel beside the board, and the
 * machine chip still opens the machine. A phone, which has no room beside, opens the ticket as its own page.
 */
test('a stop row opens its ticket beside the board; the machine chip opens the machine', async ({
  page,
  isMobile,
}, testInfo) => {
  const machine = boardMachine(testInfo.project.name);
  const token = await apiLogin('asha');
  const ticket = await breakdownOn(token, machine.id, machine.code);

  await signIn(page, 'asha');
  await openBoard(page, false);
  const tile = column(page, 'Nobody has started')
    .getByTestId('tile')
    .filter({ hasText: machine.code });
  // The sub-line is the row itself, away from the machine chip and the age link.
  await tile.locator('small').click();
  await expect(page).toHaveURL(new RegExp(`/desk/${ticket.id}$`));
  if (isMobile) {
    await expect(page.getByRole('heading', { name: new RegExp(ticket.ref) })).toBeVisible();
    return;
  }

  const pane = page.getByRole('region', { name: 'Ticket' });
  await expect(pane.getByRole('heading', { name: new RegExp(ticket.ref) })).toBeVisible();
  await expect(tile).toHaveAttribute('data-selected', 'true');
  await expect(page.getByRole('button', { name: 'Live', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await pane.getByRole('link', { name: /Open tickets/ }).click();
  await expect(page).toHaveURL(/\/desk\/board$/);
  await expect(pane).toHaveCount(0);

  // The age is the row's keyboard link to the same ticket.
  await tile.getByRole('link', { name: new RegExp(`Open the ticket for ${machine.code}`) }).click();
  await expect(page).toHaveURL(new RegExp(`/desk/${ticket.id}$`));
  await page.goto('/desk/board');

  await tile.getByRole('button', { name: machine.code }).click();
  await expect(page).toHaveURL(/\/desk\/board\?drawer=machine/);
});

const TODAY = {
  tickets: 7,
  notStarted: 2,
  stillOpen: 3,
  responseMin: 6,
  repairMin: 22,
  waitingMin: 5,
  responseCount: 6,
  responseClosed: 4,
  repairCount: 5,
  repairClosed: 3,
};

/** The day score the server sends (`GET /board/today`), replaced with fixed numbers so the tiles can be read exactly. */
async function serveToday(page: Page, today: Record<string, number | null>): Promise<void> {
  await page.route('**/api/v1/board/today', (route) =>
    route.fulfill({
      json: {
        now: new Date().toISOString(),
        from: '2026-11-14T00:00:00+05:30',
        to: '2026-11-15T00:00:00+05:30',
        ...today,
      },
    }),
  );
}

test('the board shows the plant day score: response today and repair today', async ({ page }) => {
  await serveToday(page, TODAY);
  await signIn(page, 'asha');
  await openBoard(page, false);
  const response = page.getByRole('group', { name: 'Response today' });
  const repair = page.getByRole('group', { name: 'Repair today' });
  await expect(response).toContainText('6 min');
  await expect(response).toContainText('average of 6, 4 closed');
  await expect(repair).toContainText('22 min');
  await expect(repair).toContainText('average of 5, 3 closed');
});

test('a day with nothing to average shows a dash, never 0 min', async ({ page }) => {
  await serveToday(page, {
    ...TODAY,
    responseMin: null,
    repairMin: null,
    responseCount: 0,
    responseClosed: 0,
    repairCount: 0,
    repairClosed: 0,
  });
  await signIn(page, 'asha');
  await openBoard(page, false);
  await expect(page.getByRole('group', { name: 'Response today' })).toContainText('—');
  await expect(page.getByRole('group', { name: 'Repair today' })).not.toContainText('0 min');
  await expect(page.getByRole('group', { name: 'Response today' })).not.toContainText('average');
});

test('the TV shows the same two tiles beside open over 1 day', async ({ page }) => {
  await serveToday(page, TODAY);
  await signIn(page, 'asha');
  await openBoard(page, true);
  await expect(page.getByRole('group', { name: 'Response today' })).toContainText('6 min');
  await expect(page.getByRole('group', { name: 'Repair today' })).toContainText('22 min');
  await expect(page.getByTestId('age-overDay')).toBeVisible();
});

test('the tiles come from the real server when nothing is replaced', async ({ page }) => {
  await signIn(page, 'asha');
  await openBoard(page, false);
  await expect(page.getByRole('group', { name: 'Response today' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Repair today' })).toContainText(/—|\d+ (min|h)/);
});
