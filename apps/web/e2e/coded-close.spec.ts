import { expect, test } from './test.js';
import { commandViaApi, getJson } from './fixtures-actions.js';
import { apiLogin, machineFor, raiseTicketViaApi, signIn } from './fixtures.js';

/**
 * Ticket 47: one failure-code list behind the floor's "Maintenance Code" box. A close records the code,
 * the head switches it off on Settings → Lists → Failure codes, the old ticket still shows what it recorded,
 * and a new close is offered only the codes that are still on (R2, R6, R7).
 */

interface Me {
  user: { actingPersonId: string };
}

/** A started breakdown raised through the real API, so the floor form has something to close. */
async function startedBreakdown(machineId: string, problem: string) {
  const token = await apiLogin('asha');
  const ticket = await raiseTicketViaApi(token, machineId, problem);
  const me = await getJson<Me>(token, '/api/v1/auth/me');
  await commandViaApi(token, ticket.id, 'start', { personId: me.user.actingPersonId });
  return ticket;
}

test('a close records its code, a switched-off code stays on the old ticket, and a new close hides it', async ({
  page,
}, testInfo) => {
  const machine = machineFor('desk', testInfo.project.name);
  const closed = await startedBreakdown(machine.id, `Hydraulic leak on ${machine.code}`);

  await test.step('the floor closes the breakdown with the Mechanical code', async () => {
    await signIn(page, 'asha');
    await page.goto(`/desk/${closed.id}`);
    await page.getByRole('button', { name: 'Write report and close', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to report form', exact: true }).click();
    // The one code a close carries is required: the category alone cannot send it.
    const submit = page.getByRole('button', { name: 'Close with report', exact: true });
    await page.getByLabel('Breakdown Category').selectOption({ index: 1 });
    await expect(submit).toBeDisabled();
    await page.getByLabel('Maintenance Code').selectOption({ label: 'Mechanical' });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.locator('header').getByText('Closed', { exact: true })).toBeVisible();
    await expect(
      page.locator('dt', { hasText: /^Maintenance code$/ }).locator('xpath=following-sibling::dd'),
    ).toHaveText('M');
  });

  await test.step('the head opens Failure codes on the lists hub and switches Mechanical off', async () => {
    await signIn(page, 'admin');
    await page.goto('/settings/lists');
    await page.getByRole('link', { name: /Failure codes/ }).click();
    await expect(page).toHaveURL(/\/settings\/lists\?list=failure_code/);
    await expect(page.getByRole('heading', { name: 'Failure codes', exact: true })).toBeVisible();

    // The old codes are the row's own editable field, not a hidden key.
    await page.getByRole('button', { name: 'Edit Mechanical', exact: true }).click();
    const form = page.getByRole('form', { name: 'Edit Mechanical', exact: true });
    await expect(form.getByLabel('Old codes', { exact: true })).toBeVisible();
    await expect(form.getByText(/Earlier spellings of this code/)).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(form).toBeHidden();

    await page.getByRole('button', { name: 'Switch off Mechanical', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Switch on Mechanical', exact: true }),
    ).toBeVisible();
  });

  await test.step('the old ticket keeps the code it recorded', async () => {
    await signIn(page, 'asha');
    await page.goto(`/desk/${closed.id}`);
    await expect(
      page.locator('dt', { hasText: /^Maintenance code$/ }).locator('xpath=following-sibling::dd'),
    ).toHaveText('M');
  });

  await test.step('a new close is offered every switched-on code but not the one switched off', async () => {
    const fresh = await startedBreakdown(machine.id, `Bearing noise on ${machine.code}`);
    await page.goto(`/desk/${fresh.id}`);
    await page.getByRole('button', { name: 'Write report and close', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to report form', exact: true }).click();
    const options = page.getByLabel('Maintenance Code').locator('option');
    await expect(options.filter({ hasText: 'Mechanical' })).toHaveCount(0);
    await expect(options.filter({ hasText: 'Electrical' })).toHaveCount(1);
  });
});
