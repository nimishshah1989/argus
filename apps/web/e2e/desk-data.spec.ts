import { expect, test } from './test.js';
import { commandViaApi, getJson } from './fixtures-actions.js';
import { apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';
import { signoffMachine } from './fixtures-signoff.js';

/**
 * S28 and S29 desk data: the Desk's sign-off outcomes of the last day open their ticket, and the close form's code
 * lists can be searched and put this login's last codes first. Machines SO-D and SO-E are this spec's own.
 */

interface Me {
  user: { actingPersonId: string };
}

const personOf = async (token: string) =>
  (await getJson<Me>(token, '/api/v1/auth/me')).user.actingPersonId;

/** The operator reports on `machineId`; asha starts it (and closes it with a report when `report` is given). */
async function breakdown(machineId: string, problem: string, report?: Record<string, unknown>) {
  const operator = await apiLogin('op');
  const maintenance = await apiLogin('asha');
  const ticket = await raiseTicketViaApi(operator, machineId, problem);
  const personId = await personOf(maintenance);
  await commandViaApi(maintenance, ticket.id, 'start', { personId });
  if (report)
    await commandViaApi(maintenance, ticket.id, 'close', {
      personId,
      kind: 'report',
      report: {
        problem,
        correctiveAction: 'Replaced the part',
        doneByPersonIds: [personId],
        ...report,
      },
    });
  return ticket;
}

test('a confirmed sign-off shows under the outcomes of the last day and opens its ticket', async ({
  page,
}, testInfo) => {
  const machine = signoffMachine('D', testInfo.project.name);
  const ticket = await breakdown(machine.id, 'Spindle stops', { failureComponent: 'M' });
  const operator = await apiLogin('op');
  await commandViaApi(operator, ticket.id, 'handback', {
    personId: await personOf(operator),
    response: 'confirmed',
  });

  await signIn(page);
  await page.goto('/desk');
  const outcomes = page.getByTestId('signoff-outcomes');
  await expect(page.getByTestId('signoff-feed')).toContainText('Answered in the last 24 hours');
  const row = outcomes.getByRole('link').filter({ hasText: ticket.ref });
  await expect(row).toContainText('Confirmed fixed');
  await expect(row).toContainText(machine.code);
  await expect(row).toContainText('after the close');

  await row.click();
  await expect(page).toHaveURL(new RegExp(`/desk/${ticket.id}$`));
  await expect(page.getByRole('heading', { name: ticket.ref })).toBeVisible();
});

test('the close form searches its code lists and puts my last code first', async ({
  page,
}, testInfo) => {
  const machine = signoffMachine('E', testInfo.project.name);
  // asha's last close used "Spindle alarm": it is the code her next close offers first.
  await breakdown(machine.id, 'Spindle stops', { failureComponent: 'spindle' });
  const next = await breakdown(machine.id, 'Belt noise');

  await signIn(page, 'asha');
  await page.goto(`/desk/${next.id}`);
  await page.getByRole('button', { name: 'Write report and close', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to report form', exact: true }).click();

  const code = page.getByLabel('Maintenance Code');
  const recent = code.locator('optgroup').first();
  await expect(recent).toHaveAttribute('label', 'Used last');
  await expect(recent.locator('option').first()).toHaveText('Spindle alarm');

  const search = page.locator('.v2-close-field', { has: code }).getByRole('searchbox');
  await search.fill('belt');
  const options = code.locator('option');
  await expect(options.filter({ hasText: 'Belt slipping' })).toHaveCount(1);
  await expect(options.filter({ hasText: 'Spindle alarm' })).toHaveCount(0);
  await expect(options.filter({ hasText: 'Electrical' })).toHaveCount(0);

  const submit = page.getByRole('button', { name: 'Close with report', exact: true });
  await page.getByLabel('Breakdown Category').selectOption({ index: 1 });
  await code.selectOption({ label: 'Belt slipping' });
  await expect(code).toHaveValue('belt');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator('header').getByText('Closed', { exact: true })).toBeVisible();
});
