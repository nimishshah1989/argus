import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { apiLogin, floorMachine, raiseTicketViaApi, signIn } from './fixtures.js';

/**
 * Ticket 15: the floor reports a problem in v3's order (machine, situation, problem, Send) and sees the
 * ticket number. Every test owns one FL machine per project (fixtures.ts), so they run in any order.
 */
const machineRow = (page: Page, code: string) =>
  page.getByRole('button', { name: new RegExp(`^${code}\\b`) });

async function findMachine(page: Page, code: string): Promise<void> {
  await page.getByLabel('Find a machine').fill(code.replace('FL-', ''));
  await machineRow(page, code).click();
}

async function reportStopped(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Machine has stopped/ }).click();
  await page.getByRole('button', { name: 'Spindle alarm', exact: true }).click();
  await expect(page.getByLabel('What is wrong?')).toHaveValue('Spindle alarm');
  await page.getByRole('button', { name: 'Send: machine has stopped', exact: true }).click();
}

test('reports a stopped machine found by search in four taps and shows its number', async ({
  page,
}, testInfo) => {
  const machine = floorMachine(1, testInfo.project.name);
  await signIn(page, 'op');
  await expect(page.getByRole('heading', { name: 'Which machine?' })).toBeVisible();

  await findMachine(page, machine.code);
  await expect(page.getByRole('heading', { name: 'What is the situation?' })).toBeVisible();
  await reportStopped(page);

  await expect(page.getByRole('heading', { name: 'Reported' })).toBeVisible();
  await expect(page.getByText(/^Ticket number BD-\d{4,}$/)).toBeVisible();
  await page.getByRole('button', { name: 'Report another machine', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Which machine?' })).toBeVisible();
  await expect(page.getByRole('button', { name: machine.code, exact: true })).toBeVisible();
});

test('reports a machine picked inside its group', async ({ page }, testInfo) => {
  const machine = floorMachine(2, testInfo.project.name);
  await signIn(page, 'op');
  await page.getByRole('button', { name: /^FL Floor line/ }).click();
  await expect(page.getByLabel('Machine ID')).toBeVisible();
  await machineRow(page, machine.code).click();
  await expect(page.getByText(machine.code, { exact: true })).toBeVisible();
  await reportStopped(page);
  await expect(page.getByText(/^Ticket number BD-\d{4,}$/)).toBeVisible();
});

test('a ?m= link opens the situation step for that machine', async ({ page }, testInfo) => {
  const machine = floorMachine(3, testInfo.project.name);
  await signIn(page, 'op');
  await page.goto(`/floor?m=${machine.code.toLowerCase().replace('-', ' ')}`);
  await expect(page.getByRole('heading', { name: 'What is the situation?' })).toBeVisible();
  await expect(page.getByText(machine.code, { exact: true })).toBeVisible();
});

test('a machine already reported opens its ticket instead of a second report', async ({
  page,
}, testInfo) => {
  const machine = floorMachine(4, testInfo.project.name);
  const raised = await raiseTicketViaApi(await apiLogin('bina'), machine.id, 'Coolant leak');
  await signIn(page, 'op');
  await page.getByLabel('Find a machine').fill(machine.code);
  const row = machineRow(page, machine.code);
  await expect(row).toContainText('Already reported. Tap to view the ticket.');
  await row.click();
  const sheet = page.getByRole('dialog', { name: machine.code });
  await expect(sheet).toContainText(raised.ref);
  await expect(sheet).toContainText('Coolant leak');
});

test('a stopped report on a machine with a support ticket upgrades that ticket', async ({
  page,
}, testInfo) => {
  const machine = floorMachine(5, testInfo.project.name);
  const raised = await raiseTicketViaApi(await apiLogin('bina'), machine.id, 'Noise', 'support');
  await signIn(page, 'op');
  await page.getByLabel('Find a machine').fill(machine.code);
  await expect(machineRow(page, machine.code)).toContainText(
    'Needs support. Tap to say it has stopped.',
  );
  await machineRow(page, machine.code).click();
  await expect(
    page.getByText(`This machine already has a support ticket, ${raised.ref}.`),
  ).toBeVisible();
  await page.getByRole('button', { name: /^Machine has stopped/ }).click();
  await page.getByRole('button', { name: 'Send: machine has stopped', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reported' })).toBeVisible();
  await expect(page.getByText(`Ticket number ${raised.ref}`)).toBeVisible();
  await expect(page.getByText('Stopped', { exact: true })).toBeVisible();
});

test('other work sends a work request with its number', async ({ page }) => {
  await signIn(page, 'op');
  await page.getByRole('button', { name: /^Other work \(not a machine\)/ }).click();
  await page.getByLabel('Or type the place').fill('Store room');
  await page.getByLabel('Type of work').selectOption({ label: 'Preventive' });
  await page.getByLabel('What is needed?').fill('Fix the tube light');
  await expect(page.getByText('Reporting as Omi (Operator)')).toBeVisible();
  await page.getByRole('button', { name: 'Send work request', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reported' })).toBeVisible();
  await expect(page.getByText(/^Ticket number WR-\d{4,}$/)).toBeVisible();
});

test('maintenance can start work on the ticket it reports', async ({ page }, testInfo) => {
  const machine = floorMachine(6, testInfo.project.name);
  await signIn(page, 'asha');
  await findMachine(page, machine.code);
  await page.getByRole('button', { name: /^Machine has stopped/ }).click();
  await page.getByLabel('What is wrong?').fill('Hydraulic pressure low');
  await page.getByRole('checkbox', { name: 'I am starting work on it now' }).check();
  await page.getByRole('button', { name: 'Send: machine has stopped', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reported' })).toBeVisible();
  await expect(page.getByText('In progress', { exact: true })).toBeVisible();
});

test('My complaints lists what this person reported with the floor words', async ({
  page,
}, testInfo) => {
  const machine = floorMachine(7, testInfo.project.name);
  const raised = await raiseTicketViaApi(await apiLogin('op'), machine.id, 'Chuck not clamping');
  await signIn(page, 'op');
  await page.goto('/floor/mine');
  await expect(page.getByRole('heading', { name: 'My complaints' })).toBeVisible();
  const card = page.getByRole('listitem').filter({ hasText: raised.ref });
  await expect(card).toContainText(machine.code);
  await expect(card).toContainText('Chuck not clamping');
  await expect(card).toContainText('Booked');
});

test('offline, the problem step says so and Send waits for a connection', async ({
  page,
  context,
}, testInfo) => {
  const machine = floorMachine(8, testInfo.project.name);
  await signIn(page, 'op');
  await findMachine(page, machine.code);
  await page.getByRole('button', { name: /^Machine has stopped/ }).click();
  await page.getByLabel('What is wrong?').fill('Spindle alarm');
  await context.setOffline(true);
  await expect(page.getByText('You are offline. Connect to send this.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Send: machine has stopped', exact: true }),
  ).toBeDisabled();
  await context.setOffline(false);
});
