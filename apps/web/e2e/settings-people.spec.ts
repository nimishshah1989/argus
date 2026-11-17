import { randomUUID } from 'node:crypto';
import { expect, test } from './test.js';
import { apiFetch, apiLogin, signIn } from './fixtures.js';

const unique = (prefix: string) => `${prefix} ${randomUUID().slice(0, 8)}`;

async function apiJson<T>(path: string, body: unknown): Promise<T> {
  const token = await apiLogin('admin');
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const addPerson = (name: string) =>
  apiJson<{ id: string }>('/api/v1/people', { name, team: 'maintenance' });

test('admin adds a person, is told the international number format, then edits their cell', async ({
  page,
}) => {
  const name = unique('Test Person');
  await signIn(page, 'admin');
  await page.goto('/settings/people');
  await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add person', exact: true }).click();
  const form = page.getByRole('form', { name: 'Add person' });
  await form.getByLabel('Name', { exact: true }).fill(name);
  await form.getByRole('button', { name: 'Maintenance', exact: true }).click();
  await form.getByLabel('Mobile number', { exact: true }).fill('98765 43210');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('international format');

  await form.getByLabel('Mobile number', { exact: true }).fill('+919876543210');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form).toBeHidden();

  await expect(page.getByRole('button', { name: `Edit ${name}`, exact: true })).toBeVisible();
  await expect(page.getByText('Last sign-in Never', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
  const edit = page.getByRole('form', { name: `Edit ${name}` });
  await edit.getByLabel('Cell', { exact: true }).fill('7');
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(edit).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
  await expect(
    page.getByRole('form', { name: `Edit ${name}` }).getByLabel('Cell', { exact: true }),
  ).toHaveValue('7');
});

test('switching a person off asks a reason and keeps them off', async ({ page }) => {
  const name = unique('Switch Off');
  await addPerson(name);
  await signIn(page, 'admin');
  await page.goto('/settings/people');

  await page.getByRole('button', { name: `Switch off ${name}`, exact: true }).click();
  const form = page.getByRole('form', { name: `Switch off ${name}` });
  await expect(form).toBeVisible();
  await expect(form).toContainText('clears their mobile number');
  await expect(form.getByRole('button', { name: 'Switch off', exact: true })).toBeDisabled();
  await form.getByLabel('Reason', { exact: true }).fill('Retired at the end of the shift');
  await form.getByRole('button', { name: 'Switch off', exact: true }).click();
  await expect(form).toBeHidden();
  await expect(page.getByRole('button', { name: `Switch on ${name}`, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: `Switch on ${name}`, exact: true })).toBeVisible();
});

test('admin adds a personal login and switches it back on with a new password', async ({
  page,
}) => {
  const name = unique('Login Person');
  await addPerson(name);
  const username = `login.${randomUUID().slice(0, 8)}`;
  await signIn(page, 'admin');
  await page.goto('/settings/logins');
  await expect(page.getByRole('heading', { name: 'Logins', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add login', exact: true }).click();
  const add = page.getByRole('form', { name: 'Add login' });
  await add.getByLabel('Username', { exact: true }).fill(username);
  await add.getByLabel('Role', { exact: true }).selectOption({ label: 'Technician' });
  await add.getByRole('button', { name: 'Personal', exact: true }).click();
  await add.getByLabel('Person', { exact: true }).selectOption({ label: name });
  await add.getByLabel('Temporary password', { exact: true }).fill('a-long-enough-temp-pass');
  await add.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(add).toBeHidden();
  await expect(
    page.getByRole('button', { name: `Switch off ${username}`, exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: `Switch off ${username}`, exact: true }).click();
  const off = page.getByRole('form', { name: `Switch off ${username}` });
  await off.getByLabel('Reason', { exact: true }).fill('Phone handed back');
  await off.getByRole('button', { name: 'Switch off', exact: true }).click();
  await expect(off).toBeHidden();
  await page.getByRole('button', { name: `Switch on ${username}`, exact: true }).click();
  const on = page.getByRole('form', { name: `Switch on ${username}` });
  await on.getByLabel('Temporary password', { exact: true }).fill('another-long-temp-pass');
  await on.getByRole('button', { name: 'Switch on', exact: true }).click();
  await expect(on).toBeHidden();
  await expect(
    page.getByRole('button', { name: `Switch off ${username}`, exact: true }),
  ).toBeVisible();
});

test('bulk actions change a shift, sign devices out and switch people off, each with a reason and a count', async ({
  page,
}) => {
  const [first, second] = [unique('Bulk A'), unique('Bulk B')];
  await addPerson(first);
  await addPerson(second);
  await signIn(page, 'admin');
  await page.goto('/settings/people');

  const tick = async (name: string) =>
    page.getByRole('checkbox', { name: `Select ${name}`, exact: true }).check();
  await tick(first);
  await tick(second);
  await expect(page.getByText('2 selected', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Change shift', exact: true }).click();
  const shift = page.getByRole('form', { name: 'Change the shift of 2 people' });
  await shift.getByRole('button', { name: 'E2E business hours', exact: true }).click();
  await shift.getByLabel('Reason', { exact: true }).fill('Moved to the morning shift');
  await shift.getByRole('button', { name: 'Change shift', exact: true }).click();
  await expect(shift).toBeHidden();
  await expect(page.getByText('2 of 2 done.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Shift e2e/).first()).toBeVisible();

  await tick(first);
  await tick(second);
  await page.getByRole('button', { name: 'Switch off', exact: true }).click();
  const off = page.getByRole('form', { name: 'Switch off 2 people' });
  await off.getByLabel('Reason', { exact: true }).fill('Both left the plant');
  await off.getByRole('button', { name: 'Switch off', exact: true }).click();
  await expect(off).toBeHidden();
  await expect(page.getByRole('button', { name: `Switch on ${first}`, exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Switch on ${second}`, exact: true }),
  ).toBeVisible();

  await tick('Asha');
  await page.getByRole('button', { name: 'Sign out devices', exact: true }).click();
  const out = page.getByRole('form', { name: 'Sign out the devices of 1 person' });
  await out.getByLabel('Reason', { exact: true }).fill('Phone lost on the floor');
  await out.getByRole('button', { name: 'Sign out devices', exact: true }).click();
  await expect(out).toBeHidden();
  await expect(page.getByText(/1 of 1 done; \d+ devices signed out\./)).toBeVisible();
});

test('a technician is told people settings are not theirs', async ({ page }) => {
  await signIn(page, 'asha');
  await page.goto('/settings/people');
  await expect(
    page.getByRole('heading', { name: 'No settings access', exact: true }),
  ).toBeVisible();
});
