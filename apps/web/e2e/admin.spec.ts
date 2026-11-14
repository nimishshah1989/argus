import { randomUUID } from 'node:crypto';
import { expect, test } from './test.js';
import { apiFetch, apiLogin, signIn, type ApiInit } from './fixtures.js';

interface RaisedTicket {
  id: string;
  ref: string;
}

async function apiJson<T>(token: string, path: string, init: ApiInit = {}): Promise<T> {
  const res = await apiFetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

async function actingPersonId(token: string): Promise<string> {
  const body = await apiJson<{ user: { actingPersonId: string } }>(token, '/api/v1/auth/me');
  return body.user.actingPersonId;
}

/** A general work request needs no machine, so this spec cannot fight the other specs for one. */
async function raiseGeneralTicket(token: string, problem: string): Promise<RaisedTicket> {
  const body = await apiJson<{ ticket: RaisedTicket }>(token, '/api/v1/tickets', {
    method: 'POST',
    headers: { 'idempotency-key': randomUUID() },
    body: JSON.stringify({ kind: 'general', location: 'Workshop', workType: 'Clean', problem }),
  });
  return body.ticket;
}

async function cancelTicket(token: string, ticketId: string, personId: string): Promise<void> {
  await apiJson(token, `/api/v1/tickets/${ticketId}/cancel`, {
    method: 'POST',
    headers: { 'idempotency-key': randomUUID() },
    body: JSON.stringify({ personId, reason: 'Raised by mistake' }),
  });
}

/** SPEC 1.5: the minimal admin faces (restore, correct) plus the account sheet sign-out. */
test('admin restores a cancelled ticket, corrects it, then signs out', async ({ page }) => {
  const ashaToken = await apiLogin('asha');
  const ashaPersonId = await actingPersonId(ashaToken);
  const ticket = await raiseGeneralTicket(ashaToken, 'Restore me from cancelled');
  await cancelTicket(ashaToken, ticket.id, ashaPersonId);

  await signIn(page, 'admin');
  await page.goto(`/desk/${ticket.id}`);
  await expect(page.locator('header').getByText('Cancelled', { exact: true })).toBeVisible();
  const admin = page.getByRole('region', { name: 'Admin' });
  await expect(admin).toBeVisible();

  await admin.getByRole('button', { name: 'Restore ticket', exact: true }).click();
  await admin.getByLabel('Why restore it?').fill('Cancelled by mistake');
  await admin.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.locator('header').getByText('Booked', { exact: true })).toBeVisible();

  await admin.getByRole('button', { name: 'Correct ticket', exact: true }).click();
  await admin.getByRole('textbox', { name: 'Reason', exact: true }).fill('Wrong problem text');
  await admin.getByRole('textbox', { name: 'Problem', exact: true }).fill('Corrected problem text');
  await admin.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(page.getByText('Corrected problem text')).toBeVisible();

  await page.goto('/desk');
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const sheet = page.getByRole('region', { name: 'Account' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Meera').first()).toBeVisible();
  await sheet.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  // Non-admins never see the panel.
  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);
  await expect(page.getByRole('region', { name: 'Admin' })).toHaveCount(0);
});
