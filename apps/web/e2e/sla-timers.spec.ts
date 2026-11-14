import { expect, test } from './test.js';
import { MACHINES, apiFetch, apiLogin, signIn, ticketView } from './fixtures.js';
import {
  FUTURE_PAUSE_COPY,
  POLICIES,
  cancelAndRestore,
  completePolicies,
  correctToOverdue,
  ensureSlaConfiguration,
  expectOfflineSettings,
  expectPhoneSettingsLayout,
  expectPoliciesPersisted,
  pauseWithReason,
  policyGroup,
  prepareStoppedTicket,
  raiseWorkRequest,
  savePoliciesAndWaitRule,
  timerRow,
} from './sla-test-helpers.js';

test.describe.configure({ mode: 'serial' });

test('configures policies and future pause rules, then shows ticket timers', async ({
  page,
}, testInfo) => {
  await signIn(page, 'admin');
  await page.goto('/desk/settings');
  await expect(page.getByRole('heading', { name: 'SLA policies', exact: true })).toBeVisible();
  await expect(page.getByText(FUTURE_PAUSE_COPY, { exact: true })).toBeVisible();
  const noPolicies = page.getByText(
    'No SLA policies configured. Enter all four targets and save.',
    {
      exact: true,
    },
  );
  if ((await noPolicies.count()) > 0) {
    const s1 = policyGroup(page, 'S1');
    await expect(s1.getByRole('spinbutton', { name: 'Acknowledge minutes' })).toHaveValue('');
    await expect(s1.getByRole('spinbutton', { name: 'Restore minutes' })).toHaveValue('');
  }

  await savePoliciesAndWaitRule(page);
  await expectPoliciesPersisted(page);
  if (testInfo.project.name === 'phone') await expectPhoneSettingsLayout(page);

  const machine = MACHINES[testInfo.project.name === 'phone' ? 9 : 8];
  if (!machine) throw new Error(`No SLA machine for ${testInfo.project.name}`);
  const ticket = await prepareStoppedTicket(machine, await apiLogin('admin'));
  await page.goto('/desk');
  const card = page.getByRole('link', { name: new RegExp(ticket.ref) });
  await expect(card).toContainText('Acknowledge');
  await expect(card).toContainText('Restore');
  await expect(card).toContainText('min left');
  await card.click();

  const timers = page.getByRole('region', { name: 'SLA timers', exact: true });
  await expect(timers).toContainText('Acknowledge');
  await expect(timers).toContainText('Restore');
  await expect(timers).toContainText('min left');
  await expect(page.getByRole('button', { name: 'Acknowledge', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Escalation', exact: true })).toHaveCount(0);
});

test('keeps SLA drafts through loading and a failed save', async ({ page }) => {
  let releaseConfig!: () => void;
  const configDelay = new Promise<void>((resolve) => {
    releaseConfig = resolve;
  });
  let configRequested = false;
  await page.route(/\/api\/v1\/config(?:\?.*)?$/, async (route) => {
    configRequested = true;
    await configDelay;
    await route.continue();
  });
  try {
    await signIn(page, 'admin');
    await page.goto('/desk/settings');
    await expect.poll(() => configRequested).toBe(true);
    await expect(page.getByText('Loading settings…', { exact: true })).toBeVisible();
    await expect(page.getByRole('spinbutton')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save SLA policies', exact: true })).toHaveCount(
      0,
    );
  } finally {
    releaseConfig();
  }

  await expect(policyGroup(page, 'S1')).toBeVisible();
  await completePolicies(page);
  const s1Ack = policyGroup(page, 'S1').getByRole('spinbutton', {
    name: 'Acknowledge minutes',
  });
  await s1Ack.fill('75');
  const save = page.getByRole('button', { name: 'Save SLA policies', exact: true });
  await page.route('**/api/v1/settings/sla-policies', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'internal', message: 'Test failure' } }),
    });
  });
  await save.click();
  await expect(
    page.getByRole('alert').filter({
      hasText: 'Could not save SLA policies. Your changes are still here. Try again.',
    }),
  ).toBeVisible();
  await expect(s1Ack).toHaveValue('75');
  await expect(save).toBeEnabled();
  await expect(page.getByRole('status').filter({ hasText: 'SLA policies saved' })).toHaveCount(0);

  await page.unroute('**/api/v1/settings/sla-policies');
  await s1Ack.fill('60');
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/settings/sla-policies') &&
        response.request().method() === 'PUT',
    ),
    save.click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page.getByRole('status').filter({ hasText: 'SLA policies saved' })).toBeVisible();
  await expect(s1Ack).toHaveValue('60');
});

test('gates SLA Settings for technicians without hiding ticket access', async ({ page }) => {
  await signIn(page, 'asha');
  await page.goto('/desk/settings');
  await expect(
    page.getByRole('heading', { name: 'No settings access', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('SLA policies and restore-clock wait rules require the same access.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save SLA policies', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Business hours only' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to desk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Open', exact: true, level: 1 })).toBeVisible();

  const response = await apiFetch('/api/v1/settings/sla-policies', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${await apiLogin('asha')}`,
    },
    body: JSON.stringify({
      policies: POLICIES.map((policy) => ({
        ...policy,
        ackMinutes: Number(policy.ackMinutes),
        restoreMinutes: Number(policy.restoreMinutes),
      })),
    }),
  });
  expect(response.status).toBe(403);
});

test('freezes cached Settings and ticket timers while offline', async ({ page }) => {
  await page.clock.install();
  await signIn(page, 'admin');
  await page.goto('/desk/settings');
  await savePoliciesAndWaitRule(page);
  const ticket = await raiseWorkRequest(await apiLogin('asha'), 'Offline SLA snapshot');
  await page.goto(`/desk/${ticket.id}`);
  const timers = page.getByRole('region', { name: 'SLA timers', exact: true });
  await expect(timers).toContainText('Acknowledge');
  await expect(timerRow(timers, 'Acknowledge').locator('time')).toBeVisible();
  const before = await timers.innerText();

  await page.context().setOffline(true);
  try {
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await page.clock.fastForward(120_000);
    expect(await timers.innerText()).toBe(before);
    await expectOfflineSettings(page);
  } finally {
    await page.context().setOffline(false);
  }
  await expect(
    policyGroup(page, 'S1').getByRole('spinbutton', { name: 'Acknowledge minutes' }),
  ).toBeEnabled();
});

test('follows acknowledge and restore clocks through existing ticket actions', async ({
  page,
}, testInfo) => {
  const admin = await ensureSlaConfiguration();
  const machine = MACHINES[testInfo.project.name === 'phone' ? 9 : 8];
  if (!machine) throw new Error(`No SLA lifecycle machine for ${testInfo.project.name}`);
  const ticket = await prepareStoppedTicket(machine, admin);
  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);
  const timers = page.getByRole('region', { name: 'SLA timers', exact: true });
  const acknowledge = timerRow(timers, 'Acknowledge');
  const restore = timerRow(timers, 'Restore');
  await expect(acknowledge).toContainText('min left');
  await expect(restore).toContainText('min left');

  await ticketView(page).getByRole('button', { name: 'Start work', exact: true }).click();
  await expect(acknowledge).toContainText('Stopped');
  await expect(restore).toContainText('min left');

  await pauseWithReason(page, 'vendor');
  await expect(restore).not.toContainText('Paused');
  await expect(restore).toContainText('min left');
  await ticketView(page).getByRole('button', { name: 'Resume work', exact: true }).click();
  await pauseWithReason(page, 'spare');
  await expect(restore).toContainText('Paused');
  await expect(restore).toContainText('Deadline recalculates on resume');
  await ticketView(page).getByRole('button', { name: 'Resume work', exact: true }).click();
  await expect(restore).toContainText('min left');

  await correctToOverdue(admin, ticket.id);
  await pauseWithReason(page, 'spare');
  await expect(restore).toContainText(/Paused · .+ overdue/);
  await ticketView(page).getByRole('button', { name: 'Resume work', exact: true }).click();
  await expect(restore).toContainText('overdue');

  await ticketView(page)
    .getByRole('button', { name: 'Machine running again', exact: true })
    .click();
  await expect(restore).toContainText('Stopped');
  await expect(page.locator('header').getByText('In progress', { exact: true })).toBeVisible();
  await ticketView(page).getByRole('button', { name: 'Machine stopped', exact: true }).click();
  await expect(restore).toContainText('Stopped');
  await expect(restore).not.toContainText('Deadline recalculates on resume');
  await expect(page.getByRole('button', { name: 'Acknowledge', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Escalation', exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: /Open tickets/ }).click();
  // v3: a job in progress is under Mine, not Open's Breakdowns
  await page.getByRole('navigation', { name: 'Desk' }).getByRole('link', { name: 'Mine' }).click();
  const card = page.getByRole('link', { name: new RegExp(ticket.ref) });
  await expect(card).toContainText('Acknowledge');
  await expect(timerRow(card, 'Acknowledge')).toContainText('Stopped');
  await expect(timerRow(card, 'Restore')).toContainText('Stopped');
});

test('reprojects overdue, cancelled, and restored timer states', async ({ page }) => {
  const admin = await ensureSlaConfiguration();
  const ticket = await raiseWorkRequest(await apiLogin('asha'), 'Correct and restore SLA timers');
  await correctToOverdue(admin, ticket.id);
  await signIn(page, 'admin');
  await page.goto(`/desk/${ticket.id}`);
  const timers = page.getByRole('region', { name: 'SLA timers', exact: true });
  const acknowledge = timerRow(timers, 'Acknowledge');
  const restore = timerRow(timers, 'Restore');
  await expect(acknowledge).toContainText('overdue');
  await expect(restore).toContainText('overdue');

  await cancelAndRestore(page, ticket.ref);
  await expect(acknowledge).not.toContainText('Stopped');
  await expect(restore).not.toContainText('Stopped');
  await expect(acknowledge).toContainText('overdue');
  await expect(restore).toContainText('overdue');
  await expect(timers.getByText('Ticket cancelled; restore recalculates the clock.')).toHaveCount(
    0,
  );
});

test.describe('plant time zone', () => {
  test.use({ timezoneId: 'America/New_York' });

  test('shows no SLA due time until the plant time zone loads', async ({ page }) => {
    await ensureSlaConfiguration();
    const ticket = await raiseWorkRequest(await apiLogin('asha'), 'SLA time zone');
    let releaseConfig!: () => void;
    const configDelay = new Promise<void>((resolve) => {
      releaseConfig = resolve;
    });
    await page.route(/\/api\/v1\/config(?:\?.*)?$/, async (route) => {
      await configDelay;
      await route.continue();
    });
    const timers = page.getByRole('region', { name: 'SLA timers', exact: true });
    try {
      await signIn(page, 'admin');
      await page.goto(`/desk/${ticket.id}`);
      await expect(timers).toContainText('min left');
      await expect(timers.locator('time')).toHaveCount(0);
      await expect(timers).not.toContainText('Due');
    } finally {
      releaseConfig();
    }

    const due = timerRow(timers, 'Acknowledge').locator('time');
    await expect(due).toBeVisible();
    const iso = await due.getAttribute('datetime');
    expect(await due.innerText()).toBe(
      new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(iso ?? '')),
    );
  });
});
