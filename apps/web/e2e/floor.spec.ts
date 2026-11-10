import { expect, test } from '@playwright/test';
import { machineFor, signIn } from './fixtures.js';

/** SPEC 1.3: the technician signs in, picks a machine, describes the problem and sends it. */
test('raises a stopped ticket from the floor and shows its reference', async ({
  page,
}, testInfo) => {
  const machine = machineFor('floor', testInfo.project.name);
  const machineRow = page.getByRole('button', { name: new RegExp(`^${machine.code} `) });

  await signIn(page, 'asha');
  await expect(page.getByRole('heading', { name: 'Report a problem' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stopped', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await machineRow.click();
  await expect(machineRow).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('What is wrong?').fill('Spindle alarm');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Reported' })).toBeVisible();
  await expect(page.getByText(/^BD-\d{4,}$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Report another', exact: true })).toBeVisible();
});
