import { expect, test, type Page } from '@playwright/test';
import { API_URL, MACHINES, apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';

interface OpenTicket {
  machineId: string | null;
  ref: string;
}

/** VC-7/VC-8 are board-only machines; tags and Settings use different fixtures. */
function boardMachine(projectName: string) {
  const machine = MACHINES[projectName === 'phone' ? 7 : 6];
  if (!machine) throw new Error(`No board machine fixture for ${projectName}`);
  return machine;
}

async function openTicketFor(token: string, machineId: string): Promise<OpenTicket | null> {
  const res = await fetch(`${API_URL}/api/v1/state`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as { open: OpenTicket[] };
  return body.open.find((ticket) => ticket.machineId === machineId) ?? null;
}

async function countOf(page: Page, key: string): Promise<number> {
  return Number(await page.getByTestId(`count-${key}`).textContent());
}

async function openBoard(page: Page, kiosk: boolean): Promise<void> {
  await page.goto(kiosk ? '/desk/board?kiosk=1' : '/desk/board');
  await expect(page.getByRole('heading', { name: 'Live board' })).toBeVisible();
}

/**
 * SPEC 1.7: tiles and counts follow /state, and kiosk mode drops the app navigation.
 * Other specs raise tickets on the other machines in parallel, so the counts are lower
 * bounds while the machine's own tile is matched exactly to its ticket.
 */
test('shows the live board in kiosk mode with no navigation', async ({ page }, testInfo) => {
  const machine = boardMachine(testInfo.project.name);
  const token = await apiLogin('asha');
  const existing = await openTicketFor(token, machine.id);

  await signIn(page, 'asha');
  await openBoard(page, true);

  const tile = page.getByTestId('tile').filter({ hasText: machine.code });
  await expect(tile).toHaveCount(1);
  if (existing) {
    await expect(tile).toContainText(existing.ref);
  } else {
    await expect(tile).toContainText('Idle');
    const ticket = await raiseTicketViaApi(token, machine.id, `Spindle alarm on ${machine.code}`);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Live board' })).toBeVisible();
    await expect(tile).toContainText(ticket.ref);
  }

  await expect(tile).toContainText('Open');
  expect(await countOf(page, 'total')).toBeGreaterThanOrEqual(1);
  expect(await countOf(page, 'stopped')).toBeGreaterThanOrEqual(1);
  await expect(page.getByRole('link')).toHaveCount(0);
});

test('keeps the app navigation outside kiosk mode', async ({ page }) => {
  await signIn(page, 'asha');
  await openBoard(page, false);
  await expect(page.getByRole('link', { name: 'Desk', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Report', exact: true })).toBeVisible();
});
