import { randomUUID } from 'node:crypto';
import { expect, test } from './test.js';
import { apiFetch, apiLogin, signIn } from './fixtures.js';

async function adminCall(path: string, method: string, body?: unknown): Promise<void> {
  const token = await apiLogin('admin');
  const res = await apiFetch(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`);
}

/** A person switched off with a known reason: the line the audit screen must show and filter. */
async function switchedOffPerson(): Promise<string> {
  const name = `Audit Person ${randomUUID().slice(0, 8)}`;
  const token = await apiLogin('admin');
  const res = await apiFetch('/api/v1/people', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, team: 'maintenance' }),
  });
  const person = (await res.json()) as { id: string };
  await adminCall(`/api/v1/people/${person.id}`, 'PUT', {
    active: false,
    reason: 'Retired at the end of the shift',
  });
  return name;
}

test('an admin filters the audit trail by area, person and day, and exports it', async ({
  page,
}) => {
  const name = await switchedOffPerson();
  await signIn(page, 'admin');
  await page.goto('/settings/audit');
  await expect(page.getByRole('heading', { name: 'Audit trail', exact: true })).toBeVisible();

  // The correction and configuration change is on the trail, with the reason it was given.
  await expect(page.getByText('Person switch off', { exact: true })).toBeVisible();
  await expect(page.getByText('Retired at the end of the shift', { exact: false })).toBeVisible();

  // By area: the ticket area hides the person line.
  await page.getByLabel('Area', { exact: true }).selectOption({ label: 'Tickets' });
  await expect(page.getByText('Person switch off', { exact: true })).toHaveCount(0);
  await page.getByLabel('Area', { exact: true }).selectOption({ label: 'All areas' });
  await expect(page.getByText('Person switch off', { exact: true })).toBeVisible();

  // By person: only that person's line remains.
  await page.getByLabel('Person', { exact: true }).selectOption({ label: name });
  await expect(page.getByText('Person switch off', { exact: true })).toBeVisible();

  // By day: a future range has nothing.
  await page.getByLabel('From', { exact: true }).fill('2030-01-01');
  await expect(page.getByText('No changes in this range.', { exact: true })).toBeVisible();
  await page.getByLabel('From', { exact: true }).fill('');
  await expect(page.getByText('Person switch off', { exact: true })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^audit-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('a technician is told the audit trail is not theirs', async ({ page }) => {
  await signIn(page, 'asha');
  await page.goto('/settings/audit');
  await expect(
    page.getByRole('heading', { name: 'No settings access', exact: true }),
  ).toBeVisible();
});
