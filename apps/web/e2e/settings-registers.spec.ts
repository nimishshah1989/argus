import { randomUUID } from 'node:crypto';
import { expect, test } from './test.js';
import { MACHINES, apiFetch, apiLogin, signIn } from './fixtures.js';

/**
 * The asset register screen (ticket 51a): an admin adds an AMC row, the list reads its kind, machine and watch
 * day, the kind chips filter, and the switch removes it with a reason the audit keeps (R6/R7).
 */

/** A second kind, so the kind chips have two of them: the chip list shows only the kinds that have rows. */
async function addLegalRow(machineId: string): Promise<void> {
  const token = await apiLogin('admin');
  const res = await apiFetch('/api/v1/settings/registers', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      kind: 'legal',
      machineId,
      notes: 'Test Of Pressure Vessel · Form No 11',
    }),
  });
  if (!res.ok) throw new Error(`the legal row was not created: ${res.status} ${await res.text()}`);
}

test('admin adds an AMC row, filters by kind, and removes it with a reason', async ({
  page,
}, testInfo) => {
  const wide = testInfo.project.name === 'chromium';
  if (wide) await page.setViewportSize({ width: 1440, height: 900 });
  const machine = MACHINES[0]!;
  const note = `AMC ${randomUUID().slice(0, 6)}`;

  await signIn(page, 'admin');
  await page.goto('/settings/registers');
  await expect(page.getByRole('heading', { name: 'Asset register', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add register item', exact: true }).click();
  const form = page.getByRole('form', { name: 'Add register item' });
  await form.getByRole('button', { name: 'AMC', exact: true }).click();
  await form.getByLabel('Machine', { exact: true }).selectOption({ label: machine.code });
  await form.getByLabel('Vendor', { exact: true }).fill('V-1');
  await form.getByLabel('Reference', { exact: true }).fill('R-1');
  await form.getByLabel('Starts on', { exact: true }).fill('2026-01-01');
  await form.getByLabel('Due on', { exact: true }).fill('2026-12-01');
  await form.getByLabel('Lead days', { exact: true }).fill('15');
  await form.getByLabel('Owner', { exact: true }).selectOption({ label: 'Asha' });
  await form.getByLabel('Notes', { exact: true }).fill(note);
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form).toBeHidden();

  // A second kind gives the chip row something to switch to (only kinds with rows show a chip).
  await addLegalRow(machine.id);
  await page.reload();

  // The row reads its kind, its machine and the watch day; the owner name reads too.
  const title = `AMC · ${machine.code}`;
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByText('2026-12-01', { exact: false }).first()).toBeVisible();
  if (wide) await expect(page.getByRole('cell', { name: 'Asha', exact: true })).toBeVisible();
  else await expect(page.getByText(/Asha/).first()).toBeVisible();

  // The kind chips filter the list; "All kinds" brings the row back.
  await page.getByRole('button', { name: /^Legal test/ }).click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^All kinds/ }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  // Switching off asks why, and the row is gone after reload; the audit keeps the line (R7).
  await page.getByRole('button', { name: `Switch off ${title}`, exact: true }).click();
  const off = page.getByRole('form', { name: `Switch off ${title}` });
  await expect(off).toContainText('Removing an item deletes its register line');
  await expect(off.getByRole('button', { name: 'Switch off', exact: true })).toBeDisabled();
  await off.getByLabel('Reason', { exact: true }).fill('Contract ended');
  await off.getByRole('button', { name: 'Switch off', exact: true }).click();
  await expect(off).toBeHidden();
  await page.reload();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});
