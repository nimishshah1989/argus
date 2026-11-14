import type { Browser, Page } from '@playwright/test';
import { expect, test } from './test.js';
import { TENANT_WEB_URL, apiLogin, machineFor, raiseTicketViaApi, signIn } from './fixtures.js';

// Both desk tests use the suite's machine for this project, so they run in order.
test.describe.configure({ mode: 'serial' });

/** The status pill lives in the ticket header, next to the ref. */
async function expectStatus(page: Page, label: string): Promise<void> {
  await expect(page.locator('header').getByText(label, { exact: true })).toBeVisible();
}

const deskTab = (page: Page, name: string | RegExp) =>
  page.getByRole('navigation', { name: 'Desk' }).getByRole('link', { name });

async function expectOpenBoard(page: Page, ref: string): Promise<void> {
  await page.goto('/desk');
  await expect(deskTab(page, /Open/)).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: /^Breakdowns \(\d+\)$/ })).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(ref) })).toBeVisible();
}

async function openTicket(page: Page, ref: string): Promise<void> {
  await page.getByRole('link', { name: new RegExp(ref) }).click();
  await expect(page.getByRole('heading', { name: ref })).toBeVisible();
  await expectStatus(page, 'Booked');
}

async function startWorking(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start work', exact: true }).click();
  await expectStatus(page, 'In progress');
}

/** Mine and Team only matter while the ticket is open/working, so check them mid-flight. */
/**
 * A second technician adds themselves to the ticket as support, then leaves it, in their own
 * browser context. The lifecycle continues on the first page afterwards.
 */
async function joinAndLeaveAsSupport(browser: Browser, ref: string): Promise<void> {
  const context = await browser.newContext({ baseURL: TENANT_WEB_URL });
  try {
    const other = await context.newPage();
    await signIn(other, 'bina');
    // v3: a started job leaves Open's Breakdowns and shows under Team (working now)
    await other.goto('/desk/team');
    await other.getByRole('link', { name: new RegExp(ref) }).click();
    await expect(other.getByRole('heading', { name: ref })).toBeVisible();
    await other.getByRole('button', { name: 'Add me as support', exact: true }).click();
    const joinForm = other.getByRole('form', { name: 'Add me as crew' });
    await expect(joinForm.getByLabel('Role')).toHaveValue('support');
    await joinForm.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(joinForm).toBeHidden();
    await expect(other.getByRole('button', { name: 'Leave', exact: true })).toBeVisible();
    await other.getByRole('button', { name: 'Leave', exact: true }).click();
    const leaveForm = other.getByRole('form', { name: 'Leave the ticket' });
    await leaveForm.getByLabel('Why are you leaving?').fill('Support work done');
    await leaveForm.getByRole('button', { name: 'Leave', exact: true }).click();
    await expect(leaveForm).toBeHidden();
    await expect(
      other.getByRole('button', { name: 'Add me as support', exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
}

async function checkDeskTabs(page: Page, ref: string): Promise<void> {
  const refLink = page.getByRole('link', { name: new RegExp(ref) });
  await page.getByRole('link', { name: /Open tickets/ }).click();
  await expect(deskTab(page, /Open/)).toHaveAttribute('aria-current', 'page');
  // v3: a started job leaves the Breakdowns list; Team now counts its lead
  await expect(refLink).toHaveCount(0);
  await page.getByRole('link', { name: /^Team now: \d+ on/ }).click();
  await expect(page.getByRole('region', { name: 'Working now' })).toContainText(ref);

  await deskTab(page, 'Mine').click();
  await expect(page.getByRole('region', { name: 'In progress' })).toContainText(ref);
  const dayReport = page.getByRole('link', { name: 'Day report', exact: true });
  await expect(dayReport).toBeVisible();
  await expect(dayReport).toHaveAttribute(
    'href',
    /\/api\/v1\/reports\/day\.pdf\?date=\d{4}-\d{2}-\d{2}/,
  );

  await deskTab(page, 'Team').click();
  await expect(page.getByRole('region', { name: 'Working now' })).toContainText('Asha');
  await expect(page.getByRole('region', { name: 'Waiting' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Not started' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Cancelled, last 24 hours' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Closed, last 30 days' })).toBeVisible();

  await refLink.click();
  await expect(page.getByRole('heading', { name: ref })).toBeVisible();
}

/** The closed-with-report ticket sits in the Team tab's 30-day window. */
async function checkTeamClosed(page: Page, ref: string): Promise<void> {
  await page.goto('/desk/team');
  const closed = page.getByRole('region', { name: 'Closed, last 30 days' });
  await expect(closed).toBeVisible();
  await expect(closed.getByRole('link', { name: new RegExp(ref) })).toBeVisible();
}

async function logUpdate(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Post update', exact: true }).click();
  const form = page.getByRole('form', { name: 'Log an update' });
  await form.getByLabel('What has changed?').fill('Replaced the drive belt');
  await form.getByRole('button', { name: 'Save update', exact: true }).click();
  await expect(form).toBeHidden();
  await expect(page.getByText('Replaced the drive belt')).toBeVisible();
  await expectStatus(page, 'In progress');
}

async function pauseTicket(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pause: waiting', exact: true }).click();
  const form = page.getByRole('form', { name: 'Pause the ticket' });
  await form.getByLabel('Waiting for').selectOption('spare');
  await form.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(form).toBeHidden();
  await expectStatus(page, 'Waiting');
  await expect(page.getByText('Pause reason')).toBeVisible();
}

async function resumeTicket(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Resume work', exact: true }).click();
  await expectStatus(page, 'In progress');
}

async function transferTicket(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  const form = page.getByRole('form', { name: 'Hand over the ticket' });
  await form.getByLabel('Handover note').fill('Next shift takes over');
  await form.getByRole('button', { name: 'Transfer', exact: true }).click();
  await expect(form).toBeHidden();
  await expectStatus(page, 'Transferred');
  await expect(page.getByText('Waiting for pickup')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pick up', exact: true })).toBeVisible();
}

async function pickUpTicket(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pick up', exact: true }).click();
  await expectStatus(page, 'In progress');
}

async function markMachineRunning(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Machine running again', exact: true }).click();
  await expect(page.getByText('Machine running since')).toBeVisible();
  await expect(page.locator('ol').getByText('Machine running')).toBeVisible();
}

async function markMachineStopped(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Machine stopped', exact: true }).click();
  await expect(page.locator('ol').getByText('Machine stopped')).toBeVisible();
}

async function closeWithReport(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Write report and close', exact: true }).click();
  // Step 1 of the close asks when the repair ended; step 2 is the breakdown report.
  await expect(page.getByText('When did you finish?')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to report form', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Breakdown report' })).toBeVisible();
  await page.getByLabel('Breakdown Category').selectOption({ index: 1 });
  await page.getByLabel('Maintenance Code').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Close with report', exact: true }).click();
  await expectStatus(page, 'Closed');
  await expect(page.getByText('Closed as')).toBeVisible();
  await expect(page.locator('dd').getByText('With report', { exact: true })).toBeVisible();
}

async function closeWithoutReport(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Close without report', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: /^Close without report: / });
  // The sheet requires a reason for a without-report close.
  await sheet.getByLabel('Reason').fill('Closed without the report');
  await sheet.getByRole('button', { name: 'Close ticket', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expectStatus(page, 'Closed');
}

async function checkFloorComplaints(page: Page, ref: string): Promise<void> {
  // Ticket 15: My complaints is its own floor screen; operators read their tickets there, not open the desk.
  await page.goto('/floor/mine');
  await expect(page.getByRole('heading', { name: 'My complaints' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: ref })).toBeVisible();
}

/** SPEC 1.4: the desk opens the floor ticket and drives every lifecycle step. */
test('drives a ticket through the desk lifecycle', async ({ page, browser }, testInfo) => {
  const machine = machineFor('desk', testInfo.project.name);
  const token = await apiLogin('asha');
  const ticket = await raiseTicketViaApi(token, machine.id, `Spindle alarm on ${machine.code}`);

  await signIn(page, 'asha');
  await expectOpenBoard(page, ticket.ref);
  await openTicket(page, ticket.ref);
  await startWorking(page);
  await joinAndLeaveAsSupport(browser, ticket.ref);
  await checkDeskTabs(page, ticket.ref);
  await logUpdate(page);
  await pauseTicket(page);
  await resumeTicket(page);
  await transferTicket(page);
  await pickUpTicket(page);
  await markMachineRunning(page);
  await markMachineStopped(page);
  await closeWithReport(page);
  await checkTeamClosed(page, ticket.ref);
  await checkFloorComplaints(page, ticket.ref);
});

/** SPEC 1.6: a no-report close sits on the desk until the late report is filed. */
test('keeps a no-report close on Needs report until the report is filed', async ({
  page,
}, testInfo) => {
  const machine = machineFor('desk', testInfo.project.name);
  const token = await apiLogin('asha');
  const ticket = await raiseTicketViaApi(token, machine.id, `Coolant leak on ${machine.code}`);

  await signIn(page, 'asha');
  await page.goto('/desk');
  await page.getByRole('link', { name: new RegExp(ticket.ref) }).click();
  await expect(page.getByRole('heading', { name: ticket.ref })).toBeVisible();
  await startWorking(page);
  await closeWithoutReport(page);

  await page.goto('/desk');
  const needsReport = page.getByRole('region', { name: 'Needs report' });
  await expect(needsReport).toBeVisible();
  const row = needsReport.getByRole('link', { name: new RegExp(ticket.ref) });
  await expect(row).toBeVisible();
  await row.click();

  await expect(page.getByRole('button', { name: 'Fill report', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fill report', exact: true }).click();
  await expect(page.getByRole('button', { name: 'File report', exact: true })).toBeVisible();
  await page.getByLabel('Breakdown Category').selectOption({ index: 1 });
  await page.getByLabel('Maintenance Code').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'File report', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fill report', exact: true })).toHaveCount(0);

  await page.goto('/desk');
  await expect(page.getByRole('region', { name: 'Needs report' })).toHaveCount(0);
});
