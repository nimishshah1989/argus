import { expect, test } from './test.js';
import { commandViaApi, getJson } from './fixtures-actions.js';
import { apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';
import { signoffMachine } from './fixtures-signoff.js';

/** Ticket 34 (slice 6), desk: production's waiting feed, the longest wait at the top. */

interface Me {
  user: { actingPersonId: string };
}

/** The operator reports on `slot`, maintenance closes it with a report, so production is asked to answer. */
async function closedWithReport(slot: 'A' | 'B', project: string, problem: string) {
  const machine = signoffMachine(slot, project);
  const operator = await apiLogin('op');
  const maintenance = await apiLogin('asha');
  const ticket = await raiseTicketViaApi(operator, machine.id, problem);
  const personId = (await getJson<Me>(maintenance, '/api/v1/auth/me')).user.actingPersonId;
  await commandViaApi(maintenance, ticket.id, 'start', { personId });
  await commandViaApi(maintenance, ticket.id, 'close', {
    personId,
    kind: 'report',
    report: { problem, correctiveAction: 'Replaced the part', doneByPersonIds: [personId] },
  });
  return ticket;
}

test('the desk feed puts the longest wait for production first, and a row opens its ticket', async ({
  page,
  t,
}, testInfo) => {
  // Closed in this order, so the first one has waited longer.
  const older = await closedWithReport('A', testInfo.project.name, 'Spindle noise');
  const newer = await closedWithReport('B', testInfo.project.name, 'Chuck loose');

  await signIn(page);
  await page.goto('/desk');
  const feed = page.getByTestId('signoff-feed');
  await expect(feed).toBeVisible();
  await expect(feed.getByRole('heading')).toContainText(t('signoff.deskWaiting'));
  await expect(feed.getByRole('heading')).toContainText(/\(\d+\)/);

  const links = feed.getByRole('link');
  const oldRow = links.filter({ hasText: older.ref }).first();
  const newRow = links.filter({ hasText: newer.ref }).first();
  await expect(oldRow).toBeVisible();
  await expect(newRow).toBeVisible();
  const refs = await links.evaluateAll((rows) => rows.map((row) => row.textContent ?? ''));
  expect(refs.findIndex((text) => text.includes(older.ref))).toBeLessThan(
    refs.findIndex((text) => text.includes(newer.ref)),
  );

  await oldRow.click();
  await expect(page).toHaveURL(new RegExp(`/desk/${older.id}$`));
  await expect(page.getByRole('heading', { name: older.ref })).toBeVisible();
});
