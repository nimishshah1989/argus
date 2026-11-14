import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { commandViaApi, getJson } from './fixtures-actions.js';
import { apiFetch, apiLogin, machineFor, raiseTicketViaApi, signIn } from './fixtures.js';

/** Slice 2 closes (ticket 18): the report close, close without report, mark done, the late report. */

interface Me {
  user: { actingPersonId: string };
}

async function startedTicket(machineId: string, problem: string, startedMinAgo = 60) {
  const token = await apiLogin('asha');
  const ticket = await raiseTicketViaApi(token, machineId, problem);
  const pool = new Pool({ connectionString: process.env.E2E_ADMIN_DATABASE_URL, max: 1 });
  try {
    // Move the ticket's whole history 90 minutes back so the finish time has room to step earlier.
    await pool.query(
      "UPDATE ticket SET reported_at = reported_at - interval '90 minutes' WHERE id = $1",
      [ticket.id],
    );
    await pool.query(
      "UPDATE ticket_event SET at = at - interval '90 minutes' WHERE ticket_id = $1",
      [ticket.id],
    );
  } finally {
    await pool.end();
  }
  const me = await getJson<Me>(token, '/api/v1/auth/me');
  await commandViaApi(token, ticket.id, 'start', {
    personId: me.user.actingPersonId,
    at: new Date(Date.now() - startedMinAgo * 60_000).toISOString(),
  });
  return ticket;
}

async function raiseWorkRequest(problem: string): Promise<{ id: string; ref: string }> {
  const token = await apiLogin('asha');
  const res = await apiFetch('/api/v1/tickets', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': randomUUID(),
    },
    body: JSON.stringify({ kind: 'general', location: 'Workshop', workType: 'Clean', problem }),
  });
  if (!res.ok) throw new Error(`raise failed: ${res.status} ${await res.text()}`);
  const ticket = ((await res.json()) as { ticket: { id: string; ref: string } }).ticket;
  const me = await getJson<Me>(token, '/api/v1/auth/me');
  await commandViaApi(token, ticket.id, 'start', { personId: me.user.actingPersonId });
  return ticket;
}

async function expectStatus(page: Page, label: string): Promise<void> {
  await expect(page.locator('header').getByText(label, { exact: true })).toBeVisible();
}

const tile = (page: Page, label: string) =>
  page.locator('dt', { hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::dd');

async function pickClassification(page: Page): Promise<void> {
  await page.getByLabel('Breakdown Category').selectOption({ index: 1 });
  await page.getByLabel('Maintenance Code').selectOption({ index: 1 });
}

test.describe.configure({ mode: 'serial' });

test('writes the report and closes: finish time, then the breakdown report', async ({
  page,
}, testInfo) => {
  const machine = machineFor('desk', testInfo.project.name);
  const ticket = await startedTicket(machine.id, `Spindle alarm on ${machine.code}`);
  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);

  await test.step('step 1: moving the finish time earlier shortens the repair', async () => {
    await page.getByRole('button', { name: 'Write report and close', exact: true }).click();
    await expect(page.getByRole('heading', { name: machine.code })).toBeVisible();
    await expect(page.getByText('When did you finish?')).toBeVisible();
    const shown = page.getByRole('status', { name: 'Finish time' });
    const before = await shown.textContent();
    await expect(tile(page, 'Repair')).toHaveText(/^(1 h 0|1 h 1) min$/);
    await page.getByRole('button', { name: '5 min earlier', exact: true }).click();
    await expect(shown).not.toHaveText(before ?? '');
    await expect(tile(page, 'Repair')).toHaveText(/^(55|56) min$/);
    await expect(page.getByRole('button', { name: '5 min later', exact: true })).toBeEnabled();
  });

  await test.step('step 2: the report form opens filled in', async () => {
    await page.getByRole('button', { name: 'Continue to report form', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Breakdown report' })).toBeVisible();
    await expect(page.getByLabel('Machine ID')).toHaveValue(machine.code);
    await expect(page.getByLabel(/^Done By/)).toHaveCount(3);
    await expect(page.getByLabel(/^Supported By/)).toHaveCount(1);
    await expect(page.getByLabel('Down Time (Min)')).not.toHaveValue('');
  });

  await test.step('Close with report needs the category and the code', async () => {
    const submit = page.getByRole('button', { name: 'Close with report', exact: true });
    await expect(submit).toBeDisabled();
    await page.getByLabel('Breakdown Category').selectOption({ index: 1 });
    await expect(submit).toBeDisabled();
    await page.getByLabel('Maintenance Code').selectOption({ index: 1 });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expectStatus(page, 'Closed');
    await expect(page.locator('dd').getByText('With report', { exact: true })).toBeVisible();
  });
});

test('closes without a report, then fills the report later', async ({ page }, testInfo) => {
  const machine = machineFor('desk', testInfo.project.name);
  const ticket = await startedTicket(machine.id, `Coolant leak on ${machine.code}`);
  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);

  await test.step('the reason is required', async () => {
    await page.getByRole('button', { name: 'Close without report', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: `Close without report: ${machine.code}` });
    await expect(sheet.getByText(/listed under Needs report for 7 days/)).toBeVisible();
    const submit = sheet.getByRole('button', { name: 'Close ticket', exact: true });
    await expect(submit).toBeDisabled();
    await sheet.getByLabel('Reason').fill('Small issue, fixed on the spot');
    await submit.click();
    await expectStatus(page, 'Closed');
  });

  await test.step('it waits under Needs report, where the report can be filled', async () => {
    await page.goto('/desk');
    const row = page
      .getByRole('region', { name: 'Needs report' })
      .getByRole('link', { name: new RegExp(ticket.ref) });
    await row.click();
    await page.getByRole('button', { name: 'Fill report', exact: true }).click();
    await expect(page.getByText(/closed without a report/)).toBeVisible();
    const file = page.getByRole('button', { name: 'File report', exact: true });
    await expect(file).toBeDisabled();
    await pickClassification(page);
    await file.click();
    await expect(page.getByRole('button', { name: 'Fill report', exact: true })).toHaveCount(0);
    await page.goto('/desk');
    await expect(
      page.getByRole('region', { name: 'Needs report' }).getByRole('link', {
        name: new RegExp(ticket.ref),
      }),
    ).toHaveCount(0);
  });
});

test('marks a work request done', async ({ page }) => {
  const ticket = await raiseWorkRequest('Clean the workshop floor');
  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);
  await page.getByRole('button', { name: 'Mark done', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: /^Done: / });
  const submit = sheet.getByRole('button', { name: 'Mark done', exact: true });
  await expect(submit).toBeDisabled();
  await sheet.getByLabel('What was done?').fill('Floor cleaned and checked');
  await submit.click();
  await expectStatus(page, 'Closed');
});

test('marks done while offline and sends it on reconnect', async ({ page }) => {
  const ticket = await raiseWorkRequest('Repack the shelf');
  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);
  await expectStatus(page, 'In progress');

  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'Mark done', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: /^Done: / });
  await expect(
    sheet.getByText('You are offline. This will send when you reconnect.'),
  ).toBeVisible();
  await sheet.getByLabel('What was done?').fill('Shelf repacked');
  await sheet.getByRole('button', { name: 'Mark done', exact: true }).click();
  await expect(sheet).toBeHidden();

  await page.context().setOffline(false);
  await expect(page.getByTestId('offline-banner')).toBeHidden({ timeout: 20_000 });
  await page.goto(`/desk/${ticket.id}`);
  await expectStatus(page, 'Closed');
});
