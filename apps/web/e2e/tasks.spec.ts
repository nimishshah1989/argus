import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { apiFetch, apiLogin, machineFor, raiseTicketViaApi, signIn } from './fixtures.js';
import { commandViaApi, getJson } from './fixtures-actions.js';

/**
 * Ticket 19: a job left unfinished at close becomes a child task (`v3.actions.17`), and reporting a machine
 * that already has one warns the operator (`v3.reporting.05`). One journey on the seeded plant: the desk
 * closes a breakdown and leaves a task, the Tasks tab lists it, the parent box says overdue, the task is
 * marked done with the machine-stopped minutes, and the floor is warned before it reports on that machine.
 */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

interface Me {
  user: { actingPersonId: string };
}

interface MadeTask {
  id: string;
  ref: string;
}

/** One API sign-in per worker: the server caps sign-ins per address, and every worker shares one. */
let ashaToken: Promise<string> | undefined;
const asha = (): Promise<string> => (ashaToken ??= apiLogin('asha'));

/** A task reason of this test's own, so the spec leaves the plant's list as it found it. */
async function taskReason(label: string): Promise<string> {
  const head = await apiLogin('head');
  const code = `t19-${randomUUID().slice(0, 8)}`;
  const made = await apiFetch('/api/v1/settings/lists/task_reason', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${head}` },
    body: JSON.stringify({ code, label }),
  });
  expect(made.status, await made.clone().text()).toBe(201);
  return code;
}

/** A breakdown of this spec's own, worked by the technician who will close it. */
async function workingBreakdown(machineId: string, problem: string) {
  const token = await asha();
  const ticket = await raiseTicketViaApi(token, machineId, problem);
  const me = await getJson<Me>(token, '/api/v1/auth/me');
  await commandViaApi(token, ticket.id, 'start', { personId: me.user.actingPersonId });
  return ticket;
}

/** From the report form: pick the report's two required lists, then leave the task the close carries. */
async function leaveTaskAtClose(page: Page, reason: string): Promise<void> {
  await page.getByRole('button', { name: 'Write report and close', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to report form', exact: true }).click();
  await page.getByLabel('Breakdown Category').selectOption({ index: 1 });
  await page.getByLabel('Maintenance Code').selectOption({ index: 1 });
  await page.getByRole('checkbox', { name: 'Leave a follow-up task', exact: true }).check();
  await page.getByLabel('What is left', { exact: true }).fill('Replace the spindle bearing');
  await page.getByLabel('Reason', { exact: true }).selectOption(reason);
  await page.getByLabel('Expected date', { exact: true }).fill('2000-01-01');
  await page.getByRole('button', { name: 'Close with report', exact: true }).click();
  await expect(page.locator('header').getByText('Closed', { exact: true })).toBeVisible();
}

/** The parent's follow-up box: one overdue task, with the plant's reason for it and its date. */
async function expectParentOverdue(page: Page, ref: string): Promise<void> {
  const panel = page.getByRole('region', { name: 'Follow-up tasks' });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('0 pending · 0 in progress · 1 overdue · 0 done');
  await expect(panel.getByText('Overdue', { exact: true }).first()).toBeVisible();
  await expect(panel).toContainText(ref);
  await expect(panel).toContainText('Replace the spindle bearing');
  await expect(panel).toContainText('Waiting for spare');
  await expect(panel).toContainText('expected 2000-01-01');
  const axe = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .include('[data-testid="tasks-panel"]')
    .analyze();
  expect(axe.violations).toEqual([]);
}

/** The Tasks tab: the task by state, reason and date, earliest expected date first. */
async function expectTasksTab(page: Page, ref: string): Promise<void> {
  await page.goto('/desk');
  await page
    .getByRole('group', { name: 'Open lists' })
    .getByRole('button', { name: /^Tasks \(/ })
    .click();
  const card = page.getByTestId('tasks-tab').getByRole('link').filter({ hasText: ref });
  await expect(card).toContainText('Overdue');
  await expect(card).toContainText('Waiting for spare');
  await expect(card).toContainText('expected 2000-01-01');
  const axe = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .include('[data-testid="tasks-tab"]')
    .analyze();
  expect(axe.violations).toEqual([]);
}

/** Mark done: the task says where it came from, and the sheet asks the machine-stopped minutes. */
async function markTaskDone(page: Page, task: MadeTask, machineCode: string, parentRef: string) {
  await page.goto(`/desk/${task.id}`);
  await expect(page.getByRole('region', { name: 'Follow-up task' })).toContainText(
    `Left from ${parentRef}`,
  );
  await page.getByRole('button', { name: 'Mark done', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: `Done: ${machineCode}` });
  await sheet.getByLabel('What was done?').fill('Bearing replaced');
  await sheet.getByLabel('Machine-stopped minutes').fill('45');
  await sheet.getByRole('button', { name: 'Mark done', exact: true }).click();
  await expect(page.locator('header').getByText('Closed', { exact: true })).toBeVisible();
}

test('a task left at close shows on the parent, in the Tasks tab, and is marked done with minutes', async ({
  page,
}, testInfo) => {
  const machine = machineFor('desk', testInfo.project.name);
  const reason = await taskReason('Waiting for spare');
  const ticket = await workingBreakdown(machine.id, `Spindle noise on ${machine.code}`);
  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);
  await leaveTaskAtClose(page, reason);

  const { tasks } = await getJson<{ tasks: MadeTask[] }>(
    await asha(),
    `/api/v1/tickets/${ticket.id}`,
  );
  const made = tasks[0]!;
  await expectParentOverdue(page, made.ref);
  await expectTasksTab(page, made.ref);
  await markTaskDone(page, made, machine.code, ticket.ref);

  const done = await getJson<{ tasks: { state: string; taskDownMin: number }[] }>(
    await asha(),
    `/api/v1/tickets/${ticket.id}`,
  );
  expect(done.tasks[0]).toMatchObject({ state: 'done', taskDownMin: 45 });
  await page.goto(`/desk/${ticket.id}`);
  const panel = page.getByRole('region', { name: 'Follow-up tasks' });
  await expect(panel.getByText('Done', { exact: true }).first()).toBeVisible();
  await expect(panel).toContainText('45 min machine-stopped');
});

test('reporting a machine that has a pending task warns the operator', async ({
  page,
}, testInfo) => {
  const machine = machineFor('desk', testInfo.project.name);
  const reason = await taskReason('Waiting for a part');
  const parent = await workingBreakdown(machine.id, `Bearing noise on ${machine.code}`);
  await commandViaApi(await asha(), parent.id, 'close', {
    kind: 'no_report',
    note: 'Bearing ordered',
    task: { text: 'Fit the new bearing', reasonCode: reason, expectedOn: '2999-01-01' },
  });

  await signIn(page, 'op');
  await page.getByLabel('Find a machine').fill(machine.code);
  await page.getByRole('button', { name: new RegExp(`^${machine.code}\\b`) }).click();
  const warning = page.getByText('This machine has a follow-up task', { exact: true });
  await expect(warning).toBeVisible();
  await expect(page.getByText(/^WR-\d+ · Waiting for a part · expected 2999-01-01$/)).toBeVisible();

  await page.getByRole('button', { name: /^Machine has stopped/ }).click();
  await expect(page.getByRole('heading', { name: 'What is wrong?' })).toBeVisible();
  await expect(warning).toHaveCount(0);
});
