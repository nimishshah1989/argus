import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { actionMachines, commandViaApi, getJson } from './fixtures-actions.js';
import { apiLogin, raiseTicketViaApi, signIn, ticketView } from './fixtures.js';

/**
 * The ticket detail screen (design lock B2, B3): facts, minutes, crew, history and the action bar.
 * Tickets are raised and moved through the API; every name is a fake.
 */
test.describe.configure({ mode: 'serial' });

interface Seeded {
  id: string;
  ref: string;
}
const seeded = {} as { working: Seeded; unstarted: Seeded; closed: Seeded };
const tokens = {} as Record<'asha' | 'bina' | 'op' | 'admin', string>;

async function personOf(token: string): Promise<string> {
  const me = await getJson<{ user: { actingPersonId: string } }>(token, '/api/v1/auth/me');
  return me.user.actingPersonId;
}

test.beforeAll(async () => {
  for (const login of ['asha', 'bina', 'op', 'admin'] as const)
    tokens[login] = await apiLogin(login);
  const { a, b } = actionMachines();
  const [asha, bina] = await Promise.all([personOf(tokens.asha), personOf(tokens.bina)]);

  seeded.working = await raiseTicketViaApi(tokens.op, b.id, 'Detail: spindle will not start');
  await commandViaApi(tokens.asha, seeded.working.id, 'start', { personId: asha });
  await commandViaApi(tokens.bina, seeded.working.id, 'join', { personId: bina, role: 'support' });

  seeded.unstarted = await raiseTicketViaApi(tokens.op, a.id, 'Detail: noise from the gearbox');

  seeded.closed = await raiseTicketViaApi(tokens.asha, null, 'Detail: closed work request');
  await commandViaApi(tokens.asha, seeded.closed.id, 'start', { personId: asha });
  await commandViaApi(tokens.asha, seeded.closed.id, 'close', { personId: asha, kind: 'done' });
});

/** Later specs on this worker must not see the tickets this one raised. */
test.afterAll(async () => {
  const admin = await personOf(tokens.admin);
  for (const ticket of [seeded.working, seeded.unstarted]) {
    await commandViaApi(tokens.admin, ticket.id, 'cancel', {
      personId: admin,
      reason: 'Detail spec cleanup',
    });
  }
});

/** One sign-in per login: the server caps sign-ins per address, and every worker shares one. */
async function openDetail(page: Page, login: string | null, ticket: Seeded): Promise<void> {
  if (login) await signIn(page, login);
  await page.goto(`/desk/${ticket.id}`);
  await expect(page.getByRole('heading', { name: ticket.ref })).toBeVisible();
}

test('a technician sees the working ticket, its action order, an unstarted and a closed ticket', async ({
  page,
}) => {
  await test.step('facts, minutes, crew and history of a working ticket', () => workingFacts(page));
  await test.step('the lead has Write report and close first', () => leadActions(page));
  await test.step('Start work first on an unstarted ticket', () => unstartedActions(page));
  await test.step('a closed ticket shows no Actions section', () => closedNoActions(page));
});

async function workingFacts(page: Page): Promise<void> {
  await openDetail(page, 'asha', seeded.working);
  await expect(page.getByRole('link', { name: 'Open tickets' })).toBeVisible();
  const header = page.locator('header').last();
  await expect(header.getByText('Stopped', { exact: true })).toBeVisible();
  await expect(header.getByText('In progress', { exact: true })).toBeVisible();
  await expect(page.getByText('Detail: spindle will not start')).toBeVisible();

  for (const row of ['Type', 'Reported', 'Work started', 'Response', 'Work time', 'Waiting']) {
    const term = page.getByRole('term').filter({ hasText: new RegExp(`^${row}$`) });
    await expect(term.first()).toBeVisible();
  }
  await expect(ticketView(page).getByText('Machine stopped', { exact: true })).toBeVisible();
  await expect(page.getByText('Machine downtime', { exact: true })).toBeVisible();
  await expect(page.getByText(/so far$/)).toBeVisible();
  await expect(page.getByText(/ by Asha$/).first()).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Minutes' })).toBeVisible();
  await expect(page.getByText('hands on', { exact: true })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Who worked on it' })).toBeVisible();
  const crew = page.getByRole('list').filter({ hasText: 'joined' });
  await expect(crew.getByText('Asha', { exact: true })).toBeVisible();
  await expect(crew.getByText('Bina', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Lead · joined /)).toBeVisible();
  await expect(page.getByText(/^Support · joined /)).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Full history' })).toBeVisible();
  const history = page.getByRole('list').filter({ hasText: 'Started' });
  await expect(history.getByText('Reported', { exact: true })).toBeVisible();
  await expect(history.getByText('Started', { exact: true })).toBeVisible();
  await expect(history.getByText('Joined', { exact: true })).toBeVisible();
}

async function leadActions(page: Page): Promise<void> {
  await openDetail(page, null, seeded.working);
  const buttons = page.getByRole('region', { name: 'Actions', exact: true }).getByRole('button');
  await expect(buttons.first()).toHaveText('Write report and close');
  await expect(buttons.nth(1)).toHaveText('Pause: waiting');
  await expect(buttons.nth(2)).toHaveText('Transfer');
  await expect(buttons.last()).toHaveText('Cancel ticket');
  await expect(page.getByRole('button', { name: 'Close without report' })).toBeVisible();
}

async function unstartedActions(page: Page): Promise<void> {
  await openDetail(page, null, seeded.unstarted);
  const header = page.locator('header').last();
  await expect(header.getByText('Booked', { exact: true })).toBeVisible();
  const buttons = page.getByRole('region', { name: 'Actions', exact: true }).getByRole('button');
  await expect(buttons.first()).toHaveText('Start work');
  await expect(buttons.last()).toHaveText('Cancel ticket');
}

test('an operator sees only Cancel ticket on their own unstarted ticket', async ({ page }) => {
  await openDetail(page, 'op', seeded.unstarted);
  const buttons = page.getByRole('region', { name: 'Actions', exact: true }).getByRole('button');
  await expect(buttons).toHaveText(['Cancel ticket']);
});

async function closedNoActions(page: Page): Promise<void> {
  await openDetail(page, null, seeded.closed);
  await expect(page.locator('header').last().getByText('Closed', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Actions', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel ticket' })).toHaveCount(0);
}
