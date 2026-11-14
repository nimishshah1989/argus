import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { commandViaApi, getJson } from './fixtures-actions.js';
import { apiLogin, floorMachine, raiseTicketViaApi } from './fixtures.js';

/** Slice 6 (ticket 34), floor and desk: production is asked "Is it fixed?" after maintenance closes with a report. */

interface Me {
  user: { actingPersonId: string };
}

const tokens = new Map<string, Promise<string>>();
const token = (username: string): Promise<string> => {
  if (!tokens.has(username)) tokens.set(username, apiLogin(username));
  return tokens.get(username)!;
};

/** The operator reports, maintenance (asha) starts and closes with a report: a sign-off is now asked of the operator. */
async function closedWithReport(slot: number, project: string, problem: string) {
  const machine = floorMachine(slot, project);
  const operator = await token('op');
  const maintenance = await token('asha');
  const ticket = await raiseTicketViaApi(operator, machine.id, problem);
  const personId = (await getJson<Me>(maintenance, '/api/v1/auth/me')).user.actingPersonId;
  await commandViaApi(maintenance, ticket.id, 'start', { personId });
  await commandViaApi(maintenance, ticket.id, 'close', {
    personId,
    kind: 'report',
    report: { problem, correctiveAction: 'Replaced the part', doneByPersonIds: [personId] },
  });
  return { machine, ticket };
}

async function openMyComplaints(page: Page): Promise<void> {
  const session = await token('op');
  await page.addInitScript((value) => localStorage.setItem('uptimo_token', value), session);
  await page.goto('/floor/mine');
  await expect(page.getByRole('heading', { name: 'My complaints' })).toBeVisible();
}

test('the person who reported says it is fixed and sees the turnaround both ways', async ({
  page,
}, testInfo) => {
  const { ticket } = await closedWithReport(11, testInfo.project.name, 'Noise in the spindle');
  await openMyComplaints(page);
  const card = page.getByRole('listitem').filter({ hasText: ticket.ref });
  await expect(card.getByText('Is it fixed?').first()).toBeVisible();
  await card.getByRole('button', { name: 'Yes, it is fixed' }).click();
  await expect(card.getByText(/Thank you\. You said it is fixed at/)).toBeVisible();
  await expect(card.getByText(/Maintenance took .* · you answered in/)).toBeVisible();
  await expect(card.getByRole('button', { name: 'Yes, it is fixed' })).toHaveCount(0);
});

test('"Not fixed" needs a reason, then the same ticket is open again', async ({
  page,
}, testInfo) => {
  const { ticket } = await closedWithReport(12, testInfo.project.name, 'Chuck loose');
  await openMyComplaints(page);
  const card = page.getByRole('listitem').filter({ hasText: ticket.ref });
  await card.getByRole('button', { name: 'Not fixed' }).click();
  const sheet = page.getByRole('dialog', { name: 'Not fixed' });
  await expect(
    sheet.getByText(`Maintenance will open this same ticket again, ${ticket.ref}.`),
  ).toBeVisible();
  const send = sheet.getByRole('button', { name: 'Send back to maintenance' });
  await expect(send).toBeDisabled();
  await sheet.getByLabel('What is still wrong?').fill('Still loose at high speed');
  await send.click();
  await expect(card.getByText(/You said it was not fixed at/)).toBeVisible();
  await expect(card.getByText('Your reason: Still loose at high speed')).toBeVisible();
});

test('the desk ticket shows the sign-off and both turnarounds', async ({ page }, testInfo) => {
  const { ticket } = await closedWithReport(13, testInfo.project.name, 'Coolant pump noise');
  const session = await token('asha');
  await page.addInitScript((value) => localStorage.setItem('uptimo_token', value), session);
  await page.goto(`/desk/${ticket.id}`);
  const panel = page.getByRole('region', { name: "Waiting for production's OK" });
  await expect(panel).toContainText('times out after');
  await expect(panel).toContainText('Maintenance turnaround');
  await expect(panel).toContainText('Production answer');
  await expect(panel).toContainText('Waiting');
});
