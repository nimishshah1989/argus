import { randomUUID } from 'node:crypto';
import { expect, type Locator, type Page } from '@playwright/test';
import { API_URL, apiLogin, raiseTicketViaApi, type MachineFixture } from './fixtures.js';
import type { ListItem } from '../src/api-types.js';

export const POLICIES = [
  { severity: 'S1', ackMinutes: '60', restoreMinutes: '240', businessHoursOnly: true },
  { severity: 'S2', ackMinutes: '90', restoreMinutes: '360', businessHoursOnly: false },
  { severity: 'S3', ackMinutes: '120', restoreMinutes: '480', businessHoursOnly: false },
  { severity: 'S4', ackMinutes: '180', restoreMinutes: '720', businessHoursOnly: false },
] as const;

export const FUTURE_PAUSE_COPY =
  'Applies to pauses started after this change. Existing pauses keep the rule they started with.';

async function apiJson<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status}`);
  return (await response.json()) as T;
}

export async function raiseWorkRequest(token: string, problem: string) {
  const body = await apiJson<{ ticket: { id: string; ref: string } }>(token, '/api/v1/tickets', {
    method: 'POST',
    headers: { 'idempotency-key': randomUUID() },
    body: JSON.stringify({ kind: 'general', location: 'Workshop', workType: 'Clean', problem }),
  });
  return body.ticket;
}

export function policyGroup(page: Page, severity: string) {
  return page.getByRole('group', { name: severity, exact: true });
}

export async function completePolicies(page: Page): Promise<void> {
  for (const policy of POLICIES) {
    const group = policyGroup(page, policy.severity);
    await group.getByRole('spinbutton', { name: 'Acknowledge minutes' }).fill(policy.ackMinutes);
    await group.getByRole('spinbutton', { name: 'Restore minutes' }).fill(policy.restoreMinutes);
    const businessHours = group.getByRole('checkbox', { name: 'Business hours only' });
    if (policy.businessHoursOnly) await businessHours.check();
  }
}

async function expect52PixelTarget(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Visible control has no bounding box');
  expect(box.height).toBeGreaterThanOrEqual(52);
}

export async function expectPhoneSettingsLayout(page: Page): Promise<void> {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const input of await page.getByRole('spinbutton').all()) await expect52PixelTarget(input);
  for (const checkbox of await page.getByRole('checkbox').all()) {
    const height = await checkbox.evaluate(
      (element) => element.closest('label')?.getBoundingClientRect().height ?? 0,
    );
    expect(height).toBeGreaterThanOrEqual(52);
  }
  await expect52PixelTarget(page.getByRole('button', { name: 'Save SLA policies', exact: true }));
  await expect52PixelTarget(page.getByRole('link', { name: 'Back to desk', exact: true }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

export async function savePoliciesAndWaitRule(page: Page): Promise<void> {
  await completePolicies(page);
  // Ensure Save is dirty even when the other device project already persisted the same values.
  const s1Ack = policyGroup(page, 'S1').getByRole('spinbutton', {
    name: 'Acknowledge minutes',
  });
  await s1Ack.fill('61');
  await s1Ack.fill('60');
  const spare = page.getByRole('checkbox', {
    name: 'Pause restore clock while waiting for Spare part',
    exact: true,
  });
  if (!(await spare.isChecked())) {
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/lists/wait_reason/spare') &&
          response.request().method() === 'PUT' &&
          response.status() === 200,
      ),
      spare.check(),
    ]);
  }
  const save = page.getByRole('button', { name: 'Save SLA policies', exact: true });
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/settings/sla-policies') &&
        response.request().method() === 'PUT',
    ),
    save.press('Enter'),
  ]);
  expect(response.status()).toBe(200);
  await expect(page.getByRole('status').filter({ hasText: 'SLA policies saved' })).toBeVisible();
}

export async function expectPoliciesPersisted(page: Page): Promise<void> {
  await page.reload();
  for (const policy of POLICIES) {
    const group = policyGroup(page, policy.severity);
    await expect(group.getByRole('spinbutton', { name: 'Acknowledge minutes' })).toHaveValue(
      policy.ackMinutes,
    );
    await expect(group.getByRole('spinbutton', { name: 'Restore minutes' })).toHaveValue(
      policy.restoreMinutes,
    );
    const businessHours = group.getByRole('checkbox', { name: 'Business hours only' });
    if (policy.businessHoursOnly) {
      await expect(businessHours).toBeChecked();
    } else {
      await expect(businessHours).not.toBeChecked();
    }
  }
  await expect(
    page.getByRole('checkbox', {
      name: 'Pause restore clock while waiting for Spare part',
      exact: true,
    }),
  ).toBeChecked();
}

export async function expectOfflineSettings(page: Page): Promise<void> {
  const mutations: string[] = [];
  page.on('request', (request) => {
    if (['PUT', 'POST', 'PATCH', 'DELETE'].includes(request.method())) {
      mutations.push(`${request.method()} ${request.url()}`);
    }
  });
  await page.getByRole('link', { name: /Open tickets/ }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const offlineMessage = 'Offline: Settings is read-only. Reconnect to make changes.';
  await expect(page.getByRole('status').filter({ hasText: offlineMessage })).toBeVisible();
  for (const input of await page.getByRole('spinbutton').all()) {
    await expect(input).toBeDisabled();
  }
  for (const checkbox of await page.getByRole('checkbox').all()) {
    await expect(checkbox).toBeDisabled();
  }
  await expect(page.getByRole('button', { name: 'Save SLA policies', exact: true })).toBeDisabled();
  expect(mutations).toEqual([]);
}

export function timerRow(scope: Locator, kind: 'Acknowledge' | 'Restore'): Locator {
  return scope
    .locator('dt')
    .filter({ hasText: new RegExp(`^${kind}$`) })
    .locator('..');
}

async function writeWaitFlag(token: string, code: string, pausesSla: boolean): Promise<void> {
  const config = await apiJson<{ lists: { wait_reason: ListItem[] } }>(token, '/api/v1/config');
  const item = config.lists.wait_reason.find((reason) => reason.code === code);
  if (!item) throw new Error(`Missing wait reason ${code}`);
  await apiJson(token, `/api/v1/lists/wait_reason/${code}`, {
    method: 'PUT',
    body: JSON.stringify({
      label: item.label,
      labelGu: item.labelGu ?? undefined,
      labelHi: item.labelHi ?? undefined,
      sort: item.sort,
      active: item.active,
      isVendor: item.isVendor,
      pausesSla,
      tag: item.tag ?? undefined,
    }),
  });
}

export async function ensureSlaConfiguration(): Promise<string> {
  const admin = await apiLogin('admin');
  await apiJson(admin, '/api/v1/settings/sla-policies', {
    method: 'PUT',
    body: JSON.stringify({
      policies: POLICIES.map((policy) => ({
        ...policy,
        ackMinutes: Number(policy.ackMinutes),
        restoreMinutes: Number(policy.restoreMinutes),
      })),
    }),
  });
  await writeWaitFlag(admin, 'vendor', false);
  await writeWaitFlag(admin, 'spare', true);
  return admin;
}

export async function prepareStoppedTicket(machine: MachineFixture, admin: string) {
  const me = await apiJson<{ user: { actingPersonId: string } }>(admin, '/api/v1/auth/me');
  const active = await apiJson<{ items: { id: string }[] }>(
    admin,
    `/api/v1/tickets?machineId=${machine.id}&status=open,working,waiting&limit=50`,
  );
  for (const ticket of active.items) {
    await apiJson(admin, `/api/v1/tickets/${ticket.id}/cancel`, {
      method: 'POST',
      headers: { 'idempotency-key': randomUUID() },
      body: JSON.stringify({
        personId: me.user.actingPersonId,
        reason: 'Reset SLA browser ticket',
      }),
    });
  }
  return raiseTicketViaApi(await apiLogin('asha'), machine.id, `SLA lifecycle ${machine.code}`);
}

export async function pauseWithReason(page: Page, reason: 'spare' | 'vendor'): Promise<void> {
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const form = page.getByRole('form', { name: 'Pause the ticket' });
  await form.getByLabel('Waiting for').selectOption(reason);
  await form.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(form).toBeHidden();
}

export async function correctToOverdue(admin: string, ticketId: string): Promise<void> {
  const reportedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  await apiJson(admin, `/api/v1/tickets/${ticketId}/correct`, {
    method: 'POST',
    headers: { 'idempotency-key': randomUUID() },
    body: JSON.stringify({ reason: 'Create overdue SLA browser fixture', changes: { reportedAt } }),
  });
}

export async function cancelAndRestore(page: Page, ticketRef: string): Promise<void> {
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const cancel = page.getByRole('form', { name: 'Cancel the ticket' });
  await cancel.getByLabel('Why cancel?').fill('Verify SLA restore');
  await cancel.getByRole('button', { name: 'Cancel ticket', exact: true }).click();
  await expect(cancel).toBeHidden();
  await expect(page.locator('header').getByText('Cancelled', { exact: true })).toBeVisible();
  const timers = page.getByRole('region', { name: 'SLA timers', exact: true });
  await expect(timerRow(timers, 'Acknowledge')).toContainText('Stopped');
  await expect(timerRow(timers, 'Restore')).toContainText('Stopped');
  await expect(timers.getByText('Ticket cancelled; restore recalculates the clock.')).toHaveCount(
    2,
  );

  const admin = page.getByRole('region', { name: 'Admin' });
  await admin.getByRole('button', { name: 'Restore ticket', exact: true }).click();
  await admin.getByLabel('Why restore it?').fill('Restore SLA browser ticket');
  await admin.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByRole('heading', { name: ticketRef })).toBeVisible();
  await expect(page.locator('header').getByText('Open', { exact: true })).toBeVisible();
}
