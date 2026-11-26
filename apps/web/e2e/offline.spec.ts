import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { apiFetch, apiLogin, scopedId, signIn, ticketView } from './fixtures.js';

/**
 * AC5b offline outbox (SPEC 1.9): a close made offline is queued and replayed on reconnect;
 * a replayed close whose ticket changed meanwhile becomes a visible draft, never a drop.
 *
 * These specs raise `general` work-request tickets (no machine) because every machine fixture
 * is allocated to floor/desk/board specs.
 * The offline mechanism is identical for a `done` close and a `report` close (both queue).
 */

const ASHA_PERSON_ID = scopedId('10000000-0000-0000-0000-000000000009');

interface RaisedTicket {
  id: string;
  ref: string;
}

async function raiseWorkRequest(token: string, problem: string): Promise<RaisedTicket> {
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
  const body = (await res.json()) as { ticket: RaisedTicket };
  return body.ticket;
}

async function closeViaApi(token: string, ticketId: string, personId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/tickets/${ticketId}/close`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': randomUUID(),
    },
    body: JSON.stringify({ personId, kind: 'done' }),
  });
  if (!res.ok) throw new Error(`close failed: ${res.status} ${await res.text()}`);
}

async function expectStatus(page: Page, label: string): Promise<void> {
  await expect(page.locator('header').getByText(label, { exact: true })).toBeVisible();
}

async function openAndStart(page: Page, ref: string): Promise<void> {
  await page.goto('/desk');
  // v3: a work request (a job not on a machine) is under Work
  await page.getByRole('button', { name: /^Work \(\d+\)$/ }).click();
  await page.getByRole('link', { name: new RegExp(ref) }).click();
  await expect(page.getByRole('heading', { name: ref })).toBeVisible();
  await ticketView(page).getByRole('button', { name: 'Start work', exact: true }).click();
  await expectStatus(page, 'In progress');
}

async function closeOffline(page: Page): Promise<void> {
  await ticketView(page).getByRole('button', { name: 'Mark done', exact: true }).click();
  const sheet = page.getByRole('form', { name: /^Done: / });
  await sheet.getByLabel('What was done?').fill('Finished while offline');
  await sheet.getByRole('button', { name: 'Mark done', exact: true }).click();
  await expect(sheet).toBeHidden();
}

test('queues an offline close and replays it to Closed', async ({ page }) => {
  const token = await apiLogin('asha');
  const ticket = await raiseWorkRequest(token, 'Clean the workshop');

  await signIn(page, 'asha');
  await openAndStart(page, ticket.ref);

  await page.context().setOffline(true);
  await closeOffline(page);

  // Navigate client-side (a full reload can't reach the dev server while offline) to the
  // desk, which renders the offline banner.
  await page.getByRole('link', { name: 'Open tickets' }).click();
  await expect(page.getByTestId('offline-banner')).toBeVisible();
  await expect(page.getByTestId('offline-banner')).toContainText(/offline|queued/i);

  await page.context().setOffline(false);
  // The replayed close drains the queue, so the banner disappears.
  await expect(page.getByTestId('offline-banner')).toBeHidden({ timeout: 20_000 });

  await page.goto(`/desk/${ticket.id}`);
  await expectStatus(page, 'Closed');
});

test('shows a draft when a queued close replays onto an already-closed ticket', async ({
  page,
}) => {
  const token = await apiLogin('asha');
  const ticket = await raiseWorkRequest(token, 'Repack the shelf');

  await signIn(page, 'asha');
  await openAndStart(page, ticket.ref);

  await page.context().setOffline(true);
  await closeOffline(page);
  await page.getByRole('link', { name: 'Open tickets' }).click();

  // Close the same ticket through the API while the phone is offline, so the replay 409s.
  await closeViaApi(token, ticket.id, ASHA_PERSON_ID);

  await page.context().setOffline(false);
  // The queue drains (the 409 moved the command to drafts), then the draft is visible.
  await expect(page.getByTestId('offline-banner')).toBeHidden({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await expect(page.getByTestId('drafts')).toContainText(ticket.ref);
});
