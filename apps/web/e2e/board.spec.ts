import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { MACHINES, apiFetch, apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';

interface OpenTicket {
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

test('keeps the app navigation outside kiosk mode, and a wide screen opens the TV view', async ({
  page,
}, testInfo) => {
  await signIn(page, 'asha');
  await openBoard(page, false);
  await expect(page.getByRole('link', { name: 'Desk', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Report', exact: true })).toBeVisible();
  const tvView = page.getByRole('link', { name: 'Open TV view' });
  if (testInfo.project.name !== 'chromium') return expect(tvView).toBeHidden();
  await tvView.click();
  await expect(page).toHaveURL(/\/desk\/board\?kiosk=1$/);
  await expect(page.getByRole('link')).toHaveCount(0);
});
