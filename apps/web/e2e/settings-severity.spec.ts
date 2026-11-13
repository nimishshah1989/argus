import { randomUUID } from 'node:crypto';
import type { Locator, Page, Response } from '@playwright/test';
import { expect, test } from './test.js';
import { MACHINES, apiFetch, apiLogin, signIn } from './fixtures.js';

interface RaisedTicket {
  id: string;
  ref: string;
}

/** A machine-less ticket avoids the one-open-ticket-per-machine limit in parallel specs. */
async function raiseUrgentWorkRequest(token: string, problem: string): Promise<RaisedTicket> {
  const response = await apiFetch('/api/v1/tickets', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': randomUUID(),
    },
    body: JSON.stringify({
      kind: 'general',
      location: 'Workshop',
      workType: 'Clean',
      problem,
      urgent: true,
    }),
  });
  if (!response.ok) throw new Error(`raise failed: ${response.status} ${await response.text()}`);
  const body = (await response.json()) as { ticket: RaisedTicket };
  return body.ticket;
}

async function expectSettingsControlsDisabled(page: Page): Promise<void> {
  for (const select of await page.getByRole('combobox').all()) {
    await expect(select).toBeDisabled();
  }
  const save = page.getByRole('button', { name: 'Save matrix', exact: true });
  if ((await save.count()) > 0) await expect(save).toBeDisabled();
}

async function expect52PixelTarget(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Visible control has no bounding box');
  expect(box.height).toBeGreaterThanOrEqual(52);
}

function waitForPut(page: Page, path: string): Promise<Response> {
  return page.waitForResponse(
    (response) => response.url().endsWith(path) && response.request().method() === 'PUT',
  );
}

test('admin edits criticality and the matrix, then a ticket shows the custom severity', async ({
  page,
}, testInfo) => {
  const machine = MACHINES[testInfo.project.name === 'phone' ? 5 : 4];
  if (!machine) throw new Error(`No settings machine for ${testInfo.project.name}`);

  await signIn(page, 'admin');
  await page.goto('/desk/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Machine criticality' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Severity matrix' })).toBeVisible();

  const criticality = page.getByLabel(`Criticality for ${machine.code}`, { exact: true });
  const [criticalityResponse] = await Promise.all([
    waitForPut(page, `/api/v1/machines/${machine.id}/criticality`),
    criticality.selectOption('A'),
  ]);
  expect(criticalityResponse.status()).toBe(200);
  await expect(criticality).toHaveValue('A');

  const stoppedSeverity = page.getByLabel('A Machine stopped severity', { exact: true });
  const urgentSeverity = page.getByLabel('Urgent work request', { exact: true });
  await stoppedSeverity.selectOption('S4');
  await urgentSeverity.selectOption('S2');
  const [matrixResponse] = await Promise.all([
    waitForPut(page, '/api/v1/settings/severity_matrix'),
    page.getByRole('button', { name: 'Save matrix', exact: true }).click(),
  ]);
  expect(matrixResponse.status()).toBe(200);
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toHaveText('Saved');

  await page.reload();
  await expect(criticality).toHaveValue('A');
  await expect(stoppedSeverity).toHaveValue('S4');
  await expect(urgentSeverity).toHaveValue('S2');

  if (testInfo.project.name === 'phone') {
    for (const select of await page.getByRole('combobox').all()) {
      await expect52PixelTarget(select);
    }
    await expect52PixelTarget(page.getByRole('link', { name: 'Back to desk', exact: true }));
  }

  const token = await apiLogin('asha');
  const ticket = await raiseUrgentWorkRequest(
    token,
    `Severity visibility ${testInfo.project.name}`,
  );
  await page.goto('/desk');
  const card = page.getByRole('link', { name: new RegExp(ticket.ref) });
  await expect(card.getByText('S2', { exact: true })).toBeVisible();
  await card.click();

  await expect(page.getByRole('heading', { name: ticket.ref })).toBeVisible();
  const severityFact = page
    .locator('dt')
    .filter({ hasText: /^Severity$/ })
    .locator('..');
  await expect(severityFact).toContainText('S2');
});

test('technician direct Settings URL has no edit controls', async ({ page }) => {
  await signIn(page, 'asha');
  await page.goto('/desk/settings');

  await expect(
    page.getByRole('heading', { name: 'No settings access', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Ask an admin or head to change machine criticality or the severity matrix.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save matrix', exact: true })).toHaveCount(0);
});

test('delayed initial config never exposes editable defaults', async ({ page }) => {
  let releaseConfig!: () => void;
  const configDelay = new Promise<void>((resolve) => {
    releaseConfig = resolve;
  });
  let configRequested = false;
  await page.route(/\/api\/v1\/config(?:\?.*)?$/, async (route) => {
    configRequested = true;
    await configDelay;
    await route.continue();
  });

  try {
    await signIn(page, 'admin');
    await page.goto('/desk/settings');
    await expect.poll(() => configRequested).toBe(true);
    await expect(page.getByText('Loading settings…', { exact: true })).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save matrix', exact: true })).toHaveCount(0);
  } finally {
    releaseConfig();
  }
});

test('offline cached Settings is read-only and makes no mutations', async ({ page }) => {
  await signIn(page, 'admin');
  await page.goto('/desk/settings');
  await expect(page.getByLabel('Criticality for VC-1', { exact: true })).toBeVisible();
  await expect(page.getByLabel('A Machine stopped severity', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to desk', exact: true }).click();
  const settingsLink = page.getByRole('link', { name: 'Settings', exact: true });
  await expect(settingsLink).toBeVisible();

  const mutations: string[] = [];
  page.on('request', (request) => {
    if (
      ['PUT', 'POST', 'PATCH', 'DELETE'].includes(request.method()) &&
      /\/api\/v1\/(?:settings|machines)\//.test(request.url())
    ) {
      mutations.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.context().setOffline(true);
  try {
    await settingsLink.click();
    const offlineMessage = 'Offline: Settings is read-only. Reconnect to make changes.';
    await expect(page.getByRole('status').filter({ hasText: offlineMessage })).toHaveText(
      offlineMessage,
    );
    await expectSettingsControlsDisabled(page);
    expect(mutations).toEqual([]);
  } finally {
    await page.context().setOffline(false);
  }
});
