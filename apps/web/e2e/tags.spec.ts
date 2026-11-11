import { expect, test } from '@playwright/test';
import { apiLogin, machineFor, raiseTicketViaApi, signIn } from './fixtures.js';

test('adds, persists and removes configured tags from an empty ticket', async ({
  page,
}, testInfo) => {
  const machine = machineFor('tags', testInfo.project.name);
  const token = await apiLogin('asha');
  const ticket = await raiseTicketViaApi(token, machine.id, `Tag test on ${machine.code}`);

  await signIn(page, 'asha');
  await page.goto('/desk');
  await page.getByRole('link', { name: new RegExp(ticket.ref) }).click();
  const panel = page.getByRole('region', { name: 'Tags' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('No tags yet.')).toBeVisible();

  const preventive = panel.getByRole('button', { name: 'Preventive', exact: true });
  const mechanical = panel.getByRole('button', { name: 'Mechanical', exact: true });
  await expect(preventive).toHaveAttribute('aria-pressed', 'false');
  await preventive.click();
  await expect(preventive).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(
    page
      .getByRole('region', { name: 'Tags' })
      .getByRole('button', { name: 'Preventive', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page
    .getByRole('region', { name: 'Tags' })
    .getByRole('button', { name: 'Mechanical', exact: true })
    .click();
  await expect(mechanical).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  const reloaded = page.getByRole('region', { name: 'Tags' });
  await expect(reloaded.getByRole('button', { name: 'Preventive', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(reloaded.getByRole('button', { name: 'Mechanical', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('ol').getByText('Tag added: Preventive')).toBeVisible();

  const [removeResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/tickets/') &&
        ['POST', 'DELETE'].includes(response.request().method()),
    ),
    reloaded.getByRole('button', { name: 'Preventive', exact: true }).click(),
  ]);
  expect(removeResponse.request().method()).toBe('DELETE');
  expect(removeResponse.status()).toBe(200);
  await expect(preventive).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await page
    .getByRole('region', { name: 'Tags' })
    .getByRole('button', { name: 'Mechanical', exact: true })
    .click();
  await expect(mechanical).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Tags' }).getByText('No tags yet.')).toBeVisible();
  await expect(page.locator('ol').getByText('Tag removed: Mechanical')).toBeVisible();
});
